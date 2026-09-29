
DROP DATABASE IF EXISTS campusfind_db;
CREATE DATABASE campusfind_db;
USE campusfind_db;


CREATE TABLE categories (
    category_id   INT AUTO_INCREMENT PRIMARY KEY,
    category_name VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE statuses (
    status_id   INT AUTO_INCREMENT PRIMARY KEY,
    status_name VARCHAR(20) NOT NULL UNIQUE
);


CREATE TABLE users (
    user_id      INT AUTO_INCREMENT PRIMARY KEY,
    full_name    VARCHAR(100) NOT NULL,
    contact_info VARCHAR(150) NOT NULL
);


CREATE TABLE items (
    item_id        INT AUTO_INCREMENT PRIMARY KEY,
    report_type    ENUM('Lost', 'Found') NOT NULL,
    item_name      VARCHAR(100) NOT NULL,
    category_id    INT NOT NULL,
    color          VARCHAR(30),
    location       VARCHAR(100) NOT NULL,
    date_reported  DATE NOT NULL,
    description    TEXT,
    reporter_id    INT NOT NULL,
    status_id      INT NOT NULL,
    image_path     VARCHAR(255),
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_items_category
        FOREIGN KEY (category_id) REFERENCES categories(category_id),
    CONSTRAINT fk_items_reporter
        FOREIGN KEY (reporter_id) REFERENCES users(user_id),
    CONSTRAINT fk_items_status
        FOREIGN KEY (status_id) REFERENCES statuses(status_id)
);



INSERT INTO categories (category_name) VALUES
    ('Electronics'),
    ('IDs and Cards'),
    ('Bags'),
    ('Accessories'),
    ('Personal Items');

INSERT INTO statuses (status_name) VALUES
    ('Searching'),
    ('Unclaimed'),
    ('Claimed'),
    ('Closed');

INSERT INTO users (full_name, contact_info) VALUES
    ('Alex Student',   'student@example.com'),
    ('Jamie Student',  'student@example.com'),
    ('Taylor Student', 'student@example.com'),
    ('Jordan Student', 'student@example.com'),
    ('Casey Student',  'student@example.com');


INSERT INTO items
    (report_type, item_name, category_id, color, location, date_reported, description, reporter_id, status_id)
VALUES
    ('Lost',  'Black Wallet',       2, 'Black',  'University Library', '2026-09-08',
     'Small black wallet with a student ID and two bank cards.', 1, 1),

    ('Found', 'Blue Umbrella',      4, 'Blue',   'Cafeteria',          '2026-09-07',
     'Blue foldable umbrella left near the cafeteria entrance.', 2, 2),

    ('Lost',  'Silver USB Drive',   1, 'Silver', 'Computer Lab',       '2026-09-07',
     'Small silver USB flash drive containing school documents.', 3, 1),

    ('Found', 'Student ID',         2, 'White',  'Room 204',           '2026-09-06',
     'Student identification card found inside Room 204.', 4, 3),

    ('Lost',  'White Water Bottle', 5, 'White',  'Gym',                '2026-09-05',
     'White reusable water bottle with a small sticker.', 5, 1);


SELECT
    i.item_id,
    i.report_type,
    i.item_name,
    c.category_name,
    i.color,
    i.location,
    i.date_reported,
    i.description,
    u.full_name  AS reporter_name,
    u.contact_info,
    s.status_name,
    i.image_path,
    i.created_at
FROM items i
JOIN categories c ON i.category_id = c.category_id
JOIN users u       ON i.reporter_id = u.user_id
JOIN statuses s    ON i.status_id   = s.status_id
ORDER BY i.created_at DESC;


SELECT
    COUNT(*)                                              AS total_reports,
    SUM(report_type = 'Lost')                             AS lost_items,
    SUM(report_type = 'Found')                            AS found_items,
    SUM(status_id = (SELECT status_id FROM statuses WHERE status_name = 'Claimed'))
                                                            AS claimed_items
FROM items;

SELECT * FROM items WHERE report_type = 'Lost';


SELECT * FROM items WHERE category_id = (
    SELECT category_id FROM categories WHERE category_name = 'Electronics'
);


SELECT * FROM items
WHERE item_name    LIKE '%wallet%'
   OR location     LIKE '%wallet%'
   OR description  LIKE '%wallet%';
