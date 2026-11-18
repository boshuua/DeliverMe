-- Verify delivery_app:seed_initial_data on pg

BEGIN;

SELECT 1 FROM users WHERE email = 'admin@deliverme.local';
SELECT 1 FROM users WHERE email = 'driver@deliverme.local';
SELECT 1 FROM deliveries WHERE delivery_number = 'DEL-10001';

ROLLBACK;
