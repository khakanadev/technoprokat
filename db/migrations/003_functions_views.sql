-- техника из аренды, которая уже занята в другой подтверждённой или выданной аренде на те же даты
CREATE FUNCTION busy_equipment(p_rental_id bigint)
RETURNS TABLE (equipment_id bigint, inventory_no text, name text)
LANGUAGE sql STABLE AS $$
    SELECT DISTINCT e.id, e.inventory_no, e.name
    FROM rentals r
    JOIN rental_items ri ON ri.rental_id = r.id
    JOIN rental_items oi ON oi.equipment_id = ri.equipment_id AND oi.rental_id <> r.id
    JOIN rentals o       ON o.id = oi.rental_id
    JOIN equipment e     ON e.id = ri.equipment_id
    WHERE r.id = p_rental_id
      AND o.status_id IN (2, 3)  -- confirmed, issued
      AND o.date_from <= r.date_to AND o.date_to >= r.date_from;
$$;

-- смена статуса аренды: роль, допустимость перехода, занятость, время выдачи и запись в историю.
-- ошибки уходят в API кодами TP400 / TP403 / TP404
CREATE FUNCTION change_rental_status(
    p_rental_id  bigint,
    p_to_code    text,
    p_actor_id   uuid,
    p_now        timestamptz DEFAULT now()
) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
    v_rental     rentals%ROWTYPE;
    v_role_id    smallint;
    v_role_code  text;
    v_to_id      smallint;
    v_from_title text;
    v_to_title   text;
    v_busy       text;
    v_local      timestamp;
BEGIN
    SELECT u.role_id, ro.code INTO v_role_id, v_role_code
    FROM users u JOIN roles ro ON ro.id = u.role_id
    WHERE u.id = p_actor_id AND u.is_active;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Пользователь не найден или заблокирован' USING ERRCODE = 'TP403';
    END IF;

    SELECT id, title INTO v_to_id, v_to_title FROM rental_statuses WHERE code = p_to_code;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Неизвестное состояние: %', p_to_code USING ERRCODE = 'TP400';
    END IF;

    -- блокируем строку, чтобы два запроса не меняли статус одной аренды одновременно
    SELECT * INTO v_rental FROM rentals WHERE id = p_rental_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Аренда % не найдена', p_rental_id USING ERRCODE = 'TP404';
    END IF;

    IF v_role_code = 'client' AND v_rental.client_id <> p_actor_id THEN
        RAISE EXCEPTION 'Клиент может изменять только свои аренды' USING ERRCODE = 'TP403';
    END IF;

    SELECT title INTO v_from_title FROM rental_statuses WHERE id = v_rental.status_id;

    -- переход есть, но не для этой роли -> 403; такого перехода нет вообще -> 400
    IF NOT EXISTS (SELECT 1 FROM status_transitions
                   WHERE from_status_id = v_rental.status_id AND to_status_id = v_to_id
                     AND role_id = v_role_id) THEN
        IF EXISTS (SELECT 1 FROM status_transitions
                   WHERE from_status_id = v_rental.status_id AND to_status_id = v_to_id) THEN
            RAISE EXCEPTION 'Переход «%» → «%» не разрешён роли', v_from_title, v_to_title
                USING ERRCODE = 'TP403';
        END IF;
        RAISE EXCEPTION 'Переход «%» → «%» запрещён', v_from_title, v_to_title
            USING ERRCODE = 'TP400';
    END IF;

    IF p_to_code = 'confirmed' THEN
        -- лок по каждой единице техники, иначе две параллельные заявки на одни даты
        -- обе пройдут проверку занятости
        PERFORM pg_advisory_xact_lock(ri.equipment_id)
        FROM rental_items ri WHERE ri.rental_id = p_rental_id ORDER BY ri.equipment_id;

        SELECT string_agg(b.inventory_no || ' ' || b.name, ', ') INTO v_busy
        FROM busy_equipment(p_rental_id) b;
        IF v_busy IS NOT NULL THEN
            RAISE EXCEPTION 'Техника занята на эти даты: %', v_busy USING ERRCODE = 'TP400';
        END IF;
        UPDATE rentals SET manager_id = p_actor_id WHERE id = p_rental_id;
    END IF;

    -- выдача только в часы работы пункта
    IF p_to_code = 'issued' THEN
        v_local := p_now AT TIME ZONE 'Europe/Kaliningrad';
        IF extract(isodow FROM v_local) = 7
           OR v_local::time < time '09:00' OR v_local::time > time '19:00' THEN
            RAISE EXCEPTION 'Выдача возможна только пн–сб с 9:00 до 19:00' USING ERRCODE = 'TP400';
        END IF;
    END IF;

    UPDATE rentals SET status_id = v_to_id WHERE id = p_rental_id;

    INSERT INTO rental_events (rental_id, author_id, type, text, created_at)
    VALUES (p_rental_id, p_actor_id, 'status', v_from_title || ' → ' || v_to_title, p_now);
END $$;

-- сумма аренды считается здесь, в таблице не хранится
CREATE VIEW v_rental_totals AS
SELECT r.id,
       r.client_id,
       r.manager_id,
       r.status_id,
       s.code  AS status_code,
       s.title AS status_title,
       r.date_from,
       r.date_to,
       r.created_at,
       (r.date_to - r.date_from + 1)                              AS days,
       count(ri.equipment_id)                                     AS items_count,
       coalesce(sum(ri.price_per_day), 0) * (r.date_to - r.date_from + 1) AS total,
       (s.code = 'issued' AND r.date_to < current_date)           AS is_overdue
FROM rentals r
JOIN rental_statuses s ON s.id = r.status_id
LEFT JOIN rental_items ri ON ri.rental_id = r.id
GROUP BY r.id, s.code, s.title;

-- выручка только по закрытым арендам
CREATE VIEW v_report_monthly AS
SELECT extract(year FROM date_from)::int  AS year,
       extract(month FROM date_from)::int AS month,
       count(*)                                              AS rentals_count,
       count(*) FILTER (WHERE status_code = 'closed')        AS closed_count,
       coalesce(sum(total) FILTER (WHERE status_code = 'closed'), 0) AS revenue
FROM v_rental_totals
GROUP BY 1, 2;

CREATE VIEW v_top_equipment AS
SELECT e.id, e.name, e.inventory_no, c.name AS category,
       count(ri.rental_id) AS rentals_count
FROM equipment e
JOIN categories c ON c.id = e.category_id
LEFT JOIN rental_items ri ON ri.equipment_id = e.id
GROUP BY e.id, c.name;
