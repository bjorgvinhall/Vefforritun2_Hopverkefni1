CREATE TABLE categories (
  id        SERIAL,
  category  TEXT primary key not null unique
);

CREATE TABLE products (
  product_no SERIAL,
  title     TEXT primary key not null unique,
  price     INT not null,
  text      TEXT not null,
  imgurl    TEXT,
  date      TIMESTAMP WITH TIME ZONE not null default current_timestamp,
  category  TEXT references categories(category)
);

CREATE TABLE users (
  id        SERIAL,
  username  TEXT primary key not null unique,
  password  TEXT not null, 
  email     TEXT not null unique,
  admin     BOOLEAN default false
);

CREATE TABLE cart (
  id        SERIAL primary key,
  username  TEXT references users,
  isOrder   BOOLEAN default false,
  name      TEXT,
  address   TEXT,
  date      TIMESTAMP WITH TIME ZONE default null
);

CREATE TABLE cartItems (
  cart_id   SERIAL references cart,
  username  TEXT references users,
  title     TEXT references products,
  quantity  INT not null
);
