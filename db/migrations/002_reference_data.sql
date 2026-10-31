INSERT INTO roles (id, code, title) VALUES
    (1, 'admin',   'Администратор'),
    (2, 'manager', 'Менеджер'),
    (3, 'client',  'Клиент');

INSERT INTO rental_statuses (id, code, title) VALUES
    (1, 'new',       'Новая'),
    (2, 'confirmed', 'Подтверждена'),
    (3, 'issued',    'Выдана'),
    (4, 'returned',  'Возвращена'),
    (5, 'closed',    'Закрыта'),
    (6, 'cancelled', 'Отменена');

INSERT INTO status_transitions (from_status_id, to_status_id, role_id) VALUES
    (1, 2, 2), (1, 2, 1),
    (2, 3, 2), (2, 3, 1),
    (3, 4, 2), (3, 4, 1),
    (4, 5, 2), (4, 5, 1),
    (1, 6, 3), (1, 6, 2), (1, 6, 1),
    (2, 6, 3), (2, 6, 2), (2, 6, 1);
