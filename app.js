require('dotenv').config();

const express = require('express');
const passport = require('passport');
const { Strategy, ExtractJwt } = require('passport-jwt');
const jwt = require('jsonwebtoken');
const { findById, findByEmail, comparePasswords } = require('./users');
const { catchErrors } = require('./utils');

const {
  usersGet,
  usersGetId,
  usersPatchId,
  usersRegister,
  usersGetMe,
  usersPatchMe,
} = require('./users');

const {
  productsGet,
  productsGetId,
  productsPost,
  productsImagePost,
  productsPatch,
  productsImagePatch,
  productsDelete,
  categoriesGet,
  categoriesGetId,
  categoriesPost,
  categoriesPatch,
  categoriesDelete,
} = require('./products');

const {
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

/**
 * Upphafssíða.
 * Það sem birtist þegar skipunin '/' er keyrð á get
 */
app.get('/', (req, res) => {
  res.json({
    users: {
      users: '/users',
      user: '/users/{id}',
      updateAdmin: '/users/{id}',
      register: '/users/register',
      login: '/users/login',
      me: '/users/me',
      updateMe: '/users/me',
    },
    products: {
      products: '/products',
      create: '/products',
      'products by date': '/products?category={category}',
      'products by search': '/products?search={query}',
      image: '/products/{id}/image',
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
      'update cart': '/cart',
      info: '/cart/line/{id}',
      'update line': '/cart/line/{id}',
      delete: '/cart/line/{id}',
    },
    orders: {
      orders: '/orders',
      create: '/orders',
      info: '/orders/{id}',
    },
  });
});

/**
 * Fall sem krefst þess að notandi sé innskráður
 * @param {Request} req hlutur
 * @param {Response} res hlutur
 * @param {object} next næsti hlutur
 */
function requireAuthentication(req, res, next) {
  return passport.authenticate(
    'jwt',
    { session: false },
    (err, user, info) => {
      if (err) {
        return next(err);
      }

      if (!user) {
        const error = info.name === 'TokenExpiredError'
          ? 'expired token' : 'invalid token';

        return res.status(401).json({ error });
      }

      req.user = user;
      return next();
    },
  )(req, res, next);
}

/**
 * Fall sem athugar hvort að innskráður notandi sé stjórnandi
 * @param {Request} req hlutur
 * @param {Response} res hlutur
 * @param {object} next næsti hlutur
 */
function isAdmin(req, res, next) {
  if (!req.user.admin) {
    return res.status(401).json({ error: 'Notandi verður að vera admin' });
  }
  return next();
}

/**
 * Route handler til að sækja stakan notanda gegnum GET
 * @param {object} req Request hlutur
 * @param {object} res Response hlutur
 * @returns {object} Notandi eða villa
 * get /users/:id
 */
async function userGetIdRoute(req, res) {
  const { id } = req.params;
  const user = await usersGetId(id);
  if (user) {
    return res.json(user);
  }
  return res.status(404).json({ error: 'Notandi finnst ekki' });
}

/**
 * Route hander til að breyta stjórnandastöðu notanda gegnum PATCH
 * @param {object} req Request hlutur
 * @param {object} res Response hlutur
 * @returns {object} Breytt stjórnandastaða notanda, annars villa
 * /patch /users/:id
 */
async function userPatchIdRoute(req, res) {
  const { id } = req.params;
  const admin = req.body;
  const result = await usersPatchId(id, admin.admin);
  if (!result.success && result.validation.length > 0) {
    return res.status(400).json(result.validation);
  }

  if (!result.success && result.notFound) {
    return res.status(404).json({ error: 'Notandi fannst ekki' });
  }
  return res.status(201).json(result.item);
}

/*
Skrá sig inn
*/
app.post('/users/login', async (req, res) => {
  const { email, password = '' } = req.body;
  const user = await findByEmail(email);
  if (!user) {
    return res.status(401).json({ error: 'No such user' });
  }

  const passwordIsCorrect = await comparePasswords(password, user.password);

  if (passwordIsCorrect) {
    const payload = { id: user.id };
    const tokenOptions = { expiresIn: tokenLifetime };
    const token = jwt.sign(payload, jwtOptions.secretOrKey, tokenOptions);
    return res.json({ token });
  }

  return res.status(401).json({ error: 'Invalid password' });
});

/**
 * Route handler til að sækja innskráðan notanda gegnum GET
 * @param {object} req Request hlutur
 * @param {object} res Response hlutur
 * @returns {object} Innskráður otandi eða villa
 */
async function usersGetMeRoute(req, res) {
  const userLoggedIn = req.user;
  const userId = userLoggedIn.id;
  const result = await usersGetMe(userId);
  if (req.user) {
    return res.json(result);
  }
  return res.status(404).json({ error: 'Notandi finnst ekki' });
}

/**
 * Route hander til að breyta upplýsingum innskráðs
 * notanda í gegnum PATCH
 * @param {object} req Request hlutur
 * @param {object} res Response hlutur
 * @returns {object} Breyttur notandi, annars villa
 * /patch /users/admin/:id
 */
async function usersPatchMeRoute(req, res) {
  const userLoggedIn = req.user;
  const userId = userLoggedIn.id;

  const { password, email } = req.body;
  const user = { password, email };

  const result = await usersPatchMe(userId, user);

  if (!result.success && result.validation.length > 0) {
    return res.status(400).json(result.validation);
  }

  if (!result.success && result.notFound) {
    return res.status(404).json({ error: 'Notandi fannst ekki' });
  }
  return res.status(201).json(result.item);
}

// hafa öll route á '/:id' neðst, annars er alltaf farið inn í þau
app.get('/users/', requireAuthentication, isAdmin, catchErrors(usersGet));
app.post('/users/register', catchErrors(usersRegister));
app.get('/users/me/', requireAuthentication, catchErrors(usersGetMeRoute));
app.patch('/users/me/', requireAuthentication, catchErrors(usersPatchMeRoute));
app.get('/users/:id', requireAuthentication, isAdmin, catchErrors(userGetIdRoute));
app.patch('/users/:id', requireAuthentication, isAdmin, catchErrors(userPatchIdRoute));

app.get('/products/', catchErrors(productsGet));
app.post('/products/', requireAuthentication, isAdmin, catchErrors(productsPost));
app.post('/products/:id/image', requireAuthentication, catchErrors(productsImagePost));
app.get('/products/:id', catchErrors(productsGetId));
app.patch('/products/:id', requireAuthentication, isAdmin, catchErrors(productsPatch));
app.patch('/products/:id/image', requireAuthentication, catchErrors(productsImagePatch));
app.delete('/products/:id', requireAuthentication, isAdmin, catchErrors(productsDelete));

app.get('/categories/', catchErrors(categoriesGet));
app.post('/categories/', requireAuthentication, isAdmin, catchErrors(categoriesPost));
app.get('/categories/:id', catchErrors(categoriesGetId));
app.patch('/categories/:id', requireAuthentication, isAdmin, catchErrors(categoriesPatch));
app.delete('/categories/:id', requireAuthentication, isAdmin, catchErrors(categoriesDelete));

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
