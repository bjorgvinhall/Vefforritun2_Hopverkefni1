/** @module api */

const express = require('express');

const {
  getProducts,
  getProductId,
  createProduct,
  updateProduct,
  deleteProduct,
  getCategories,
  getCategoriesId,
  createCategory,
  updateCategory,
  deleteCategory,
} = require('./products');

const {
  usersList,
  userList,
  usersPatch,
  usersPostRegister,
  usersPostLogin,
  usersGetMe,
  usersPatchMe,

} = require('./users');

/* const {
  productsList,
  productPost,
  productList,
  productPatch,
  productDelete,
} = require('./products');

const {
  categoriesList,
  categoriesPost,
  categoryList,
  categoriesPatch,
  categoriesDelete,
} = require('./categories'); */

const {
  cartsList,
  cartAdd,
  cartList,
  cartPatch,
  cartDelete,
} = require('./cart');

const {
  ordersList,
  ordersPost,
  orderList,
} = require('./orders');

const {
  catchErrors,
  ensureLoggedIn,
  ensureAdmin,
  sanitizeXss,
} = require('./utils');

const router = express.Router();

async function productsGet(req, res) {
  const { order, category } = req.query;

  const result = await getProducts(order, category);

  return res.json(result);
}

async function productsGetId(req, res) {
  const { id } = req.params;

  const result = await getProductId(id);

  if (result) {
    return res.json(result);
  }

  return res.status(404).json({ error: 'Item not found' });
}

async function productsPost(req, res) {
  const { title, price, text, imgurl, category } = req.body;

  const result = await createProduct({ title, price, text, imgurl, category });

  if (!result.success && result.existingProduct) {
    return res.status(400).json({ error: 'Product already exists' });
  }

  if (!result.success && !result.existingCategory && result.validation.length === 0) {
    return res.status(400).json({ error: 'Category does not exist' });
  }

  if (!result.success) {
    return res.status(400).json(result.validation);
  }

  return res.status(201).json(result.item);
}

async function productsPatch(req, res) {
  const { id } = req.params;
  const { title, price, text, imgurl, category } = req.body;

  const item = { title, price, text, imgurl, category };

  const result = await updateProduct(id, item);

  if (!result.success && result.validation.length > 0) {
    return res.status(400).json(result.validation);
  }

  if (!result.success && result.notFound) {
    return res.status(404).json({ error: 'Item not found' });
  }

  return res.status(201).json(result.item);
}

async function productsDelete(req, res) {
  const { id } = req.params;

  const deleted = await deleteProduct(id);

  if (deleted) {
    return res.status(204).json({});
  }

  return res.status(404).json({ error: 'Item not found' });
}

async function categoriesGet(req, res) {
  const result = await getCategories();

  return res.json(result);
}

async function categoriesGetId(req, res) {
  const { id } = req.params;

  const result = await getCategoriesId(id);

  if (result) {
    return res.json(result);
  }

  return res.status(404).json({ error: 'Item not found' });
}

async function categoriesPost(req, res) {
  const { category } = req.body;

  const result = await createCategory({ category });

  if (result.existing) {
    return res.status(400).json({ error: 'Category already exists' });
  }

  if (!result.success) {
    return res.status(400).json(result.validation);
  }

  return res.status(201).json(result.item);
}

async function categoriesPatch(req, res) {
  const { id } = req.params;
  const { category } = req.body;

  const item = { category };

  const result = await updateCategory(id, item);

  if (!result.success && result.existing) {
    return res.status(400).json({ error: 'Category already exists' });
  }

  if (!result.success && result.validation.length > 0) {
    return res.status(400).json(result.validation);
  }

  if (!result.success && result.notFound) {
    return res.status(404).json({ error: 'Item not found' });
  }

  return res.status(201).json(result.item);
}

async function categoriesDelete(req, res) {
  const { id } = req.params;

  const deleted = await deleteCategory(id);

  if (deleted) {
    return res.status(204).json({});
  }

  return res.status(404).json({ error: 'Item not found' });
}

router.get('/users/', ensureAdmin, catchErrors(usersList));
router.get('/users/:id', ensureAdmin, catchErrors(userList));
router.patch('/users/:id', ensureAdmin, catchErrors(usersPatch));
router.post('/users/register', catchErrors(usersPostRegister));
router.post('/users/login', catchErrors(usersPostLogin));
router.get('/users/me', ensureLoggedIn, catchErrors(usersGetMe));
router.patch('/users/me', ensureLoggedIn, catchErrors(usersPatchMe));

router.get('/products/', catchErrors(productsGet));
router.get('/products/:id', catchErrors(productsGetId));
router.post('/products/', ensureAdmin, catchErrors(productsPost));
router.patch('/products/:id', ensureAdmin, catchErrors(productsPatch));
router.delete('/products/:id', ensureAdmin, catchErrors(productsDelete));

router.get('/categories/', catchErrors(categoriesGet));
router.get('/categories/:id', catchErrors(categoriesGetId));
router.post('/categories/', ensureAdmin, catchErrors(categoriesPost));
router.patch('/categories/:id', ensureAdmin, catchErrors(categoriesPatch));
router.delete('/categories/:id', ensureAdmin, catchErrors(categoriesDelete));

router.get('/cart', ensureLoggedIn, catchErrors(cartsList));
router.post('/cart', ensureLoggedIn, catchErrors(cartAdd));
router.get('/cart/:id', ensureLoggedIn, catchErrors(cartList));
router.patch('/cart/:id', ensureLoggedIn, catchErrors(cartPatch));
router.delete('/cart/:id', ensureLoggedIn, catchErrors(cartDelete));

/* router.get('/orders', ensureLoggedIn, catchErrors(ordersList));
router.post('/orders', ensureLoggedIn, catchErrors(ordersPost));
router.get('/orders/:id', ensureLoggedIn, catchErrors(orderList)); */

module.exports = router;
