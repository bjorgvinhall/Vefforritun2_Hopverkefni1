INSERT INTO users
(username, password, email, admin)
VALUES
('admin', '$2b$11$T5X6dWZgfLHUP77RCSUF1uk2CqAZ398d3o30lFNDWIeWJxZhFDzf2', 'admin@example.com', true);

INSERT INTO users
(username, password, email, admin)
VALUES
('melkorka', '$2b$05$OmXmsK84lxur6UbFrmaU6etCQ4B5UzVQkVNwlIhrwgh4x34vLqEWe', 'mel@mel.com', false);

INSERT INTO cart
(username)
VALUES
('admin');
