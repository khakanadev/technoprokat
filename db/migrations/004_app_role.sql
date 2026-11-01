-- права учётки приложения: без DDL, без удаления аренд и пользователей, история только на добавление
GRANT USAGE ON SCHEMA public TO technoprokat_app;

GRANT SELECT ON roles, rental_statuses, status_transitions, schema_migrations TO technoprokat_app;
GRANT SELECT, INSERT, UPDATE ON categories, equipment, users, rentals TO technoprokat_app;
GRANT SELECT, INSERT, DELETE ON rental_items TO technoprokat_app;
GRANT SELECT, INSERT ON rental_events TO technoprokat_app;
GRANT SELECT ON v_rental_totals, v_report_monthly, v_top_equipment TO technoprokat_app;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO technoprokat_app;
GRANT EXECUTE ON FUNCTION change_rental_status(bigint, text, uuid, timestamptz),
                          busy_equipment(bigint) TO technoprokat_app;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
