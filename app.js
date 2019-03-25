require('dotenv').config();

const express = require('express');
const passport = require('passport');
const { Strategy, ExtractJwt } = require('passport-jwt');
const jwt = require('jsonwebtoken');
const { findById, findByUsername, comparePasswords } = require('./users');
const { catchErrors } = require('./utils');

const { // EKKI tilbúið, gera þessar aðferðir inní users.js
  users,
  usersList,
  usersPatch,
  usersPatchMe,
  usersGetMe,
} = require('./users');

const { // tilbúið, allar products og categories aðferðir
  productsGet,
  productsGetId,
  productsPost,
  productsPatch,
  productsDelete,
  categoriesGet,
  categoriesGetId,
  categoriesPost,
  categoriesPatch,
  categoriesDelete,
} = require('./products');

const { // EKKI tilbúið, útfæra þessar aðferðir inní cart.js
  cartsList,
  cartAdd,
  cartList,
  cartPatch,
  cartDelete,
  ordersList,
  ordersPost,
  orderList,
} = require('./cart');

const {
  PORT: port = 3000,
  HOST: host = '127.0.0.1',
  JWT_SECRET: jwtSecret,
  TOKEN_LIFETIME: tokenLifetime = 24 * 60 * 1000, // 1 dagur
} = process.env;


if (!jwtSecret) {
  console.error('JWT_SECRET not registered in .env');
  process.exit(1);
}

const app = express();
app.use(express.json());

const jwtOptions = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: jwtSecret,
};

async function strat(data, next) {
  const user = await findById(data.id);

  if (user) {
    next(null, user);
  } else {
    next(null, false);
  }
}

passport.use(new Strategy(jwtOptions, strat));

app.use(passport.initialize());
app.use(passport.session());

function requireAuthentication(req, res, next) {
  return passport.authenticate(
    'jwt',
    { session: false },
    (err, user, info) => {
      if (err) {
        return next(err);
      }

      if (!user) {
        const error = info.name === 'TokenExpiredError' ?
          'expired token' : 'invalid token';

        return res.status(401).json({ error });
      }

      req.user = user;
      return next();
    },
  )(req, res, next);
}

/**
 * Route handler til að sækja stakan notanda gegnum GET
 * @param {object} req Request hlutur
 * @param {object} res Response hlutur
 * @returns {object} Notandi eða villa
 */
async function userRoute(req, res) {
  const { id } = req.params;
  const user = await usersList(id);
  if (user) {
    return res.json(user);
  }
  return res.status(404).json({ error: 'Notandi finnst ekki' });
}

/**
 * Route handler til að breyta notanda gegnum PATCH
 * @param {object} req Request hlutur
 * @param {object} res Response hlutur
 * @returns {object} Breyttur notandi, annars villa
 */
async function userPatchRoute(req, res) {
  const { id, admin } = req.params;
  const { username, password, email } = req.body;

  const user = { username, password, email };

  const result = await usersPatch(id, user, admin);

  if (!result.success && result.validation.length > 0) {
    return res.status(400).json(result.validation);
  }

  if (!result.success && result.notFound) {
    return res.status(404).json({ error: 'Notandi fannst ekki' });
  }
  return res.status(201).json(result.item);
}

app.get('/', (req, res) => {
  res.json({
    users: {
      users: '/users',
      user: '/users/{id}',
      update: '/users/{id}',
      register: '/users/register',
      login: '/users/login',
      me: '/users/me',
      'Update me': '/users/me',
    },
    products: {
      products: '/products',
      create: '/products',
      'products by date': '/products?category={category}',
      'products by search': '/products?category={category}',
      product: '/products/{id}',
      update: '/products/{id}',
      delete: '/products/{id}',
    },
    categories: {
      categories: '/categories',
      create: '/categories',
      update: '/categories({id}',
      delete: '/categories/{id}',
    },
    cart: {
      cart: '/cart',
      update: '/cart',
      info: '/cart/line/{id}',
      update: '/cart/line/{id}',
      delete: '/cart/line/{id}',
    },
    orders: {
      orders: '/orders',
      create: '/orders',
      info: '/orders/{id}',
    },
  });
});

app.post('/users/login', async (req, res) => {
  const { username, password = '' } = req.body;

  const user = await findByUsername(username);

  if (!user) {
    return res.status(401).json({ error: 'No such user' });
  }

  const passwordIsCorrect =
    await comparePasswords(password, user.password);

  if (passwordIsCorrect) {
    const payload = { id: user.id };
    const tokenOptions = { expiresIn: tokenLifetime };
    const token = jwt.sign(payload, jwtOptions.secretOrKey, tokenOptions);
    return res.json({ token });
  }

  return res.status(401).json({ error: 'Invalid password' });
});

app.get('/admin', requireAuthentication, (req, res) => {
  res.json({ data: 'top secret' });
});


// hafa öll route á '/:id' neðst, annars er alltaf farið inn í þau
app.get('/users/', requireAuthentication, catchErrors(users));
app.get('/users/me/', requireAuthentication, catchErrors(usersGetMe));
app.patch('/users/me/', requireAuthentication, catchErrors(usersPatchMe));
app.get('/users/:id', requireAuthentication, catchErrors(userRoute));
app.patch('/users/:id', requireAuthentication, catchErrors(userPatchRoute));
// register og login eru aðeins ofar í þessari skrá, meira vesen að hafa þær í users.js
// app.post('/users/register', catchErrors(usersCreate));
// app.post('/users/login', catchErrors(usersLogin));

app.get('/products/', catchErrors(productsGet));
app.post('/products/', requireAuthentication, catchErrors(productsPost));
app.get('/products/:id', catchErrors(productsGetId));
app.patch('/products/:id', requireAuthentication, catchErrors(productsPatch));
app.delete('/products/:id', requireAuthentication, catchErrors(productsDelete));

app.get('/categories/', catchErrors(categoriesGet));
app.post('/categories/', requireAuthentication, catchErrors(categoriesPost));
app.get('/categories/:id', catchErrors(categoriesGetId));
app.patch('/categories/:id', requireAuthentication, catchErrors(categoriesPatch));
app.delete('/categories/:id', requireAuthentication, catchErrors(categoriesDelete));

app.get('/cart', requireAuthentication, catchErrors(cartsList));
app.post('/cart', requireAuthentication, catchErrors(cartAdd));
app.get('/cart/line/:id', requireAuthentication, catchErrors(cartList));
app.patch('/cart/line/:id', requireAuthentication, catchErrors(cartPatch));
app.delete('/cart/line/:id', requireAuthentication, catchErrors(cartDelete));

app.get('/orders', requireAuthentication, catchErrors(ordersList));
app.post('/orders', requireAuthentication, catchErrors(ordersPost));
app.get('/orders/:id', requireAuthentication, catchErrors(orderList));

function notFoundHandler(req, res, next) { // eslint-disable-line
  console.warn('Not found', req.originalUrl);
  res.status(404).json({ error: 'Not found' });
}

function errorHandler(err, req, res, next) { // eslint-disable-line
  console.error(err);

  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Invalid json' });
  }

  return res.status(500).json({ error: 'Internal server error' });
}

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(port, () => {
  if (host) {
    console.info(`Server running at http://${host}:${port}/`);
  }
});
