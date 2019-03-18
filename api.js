/** @module api */

const express = require('express');

/* const {
  listTodos,
  createTodo,
  readTodo,
  updateTodo,
  deleteTodo,
} = require('./todos'); */

const {
  listCategories,
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

const router = express.Router();

/**
 * Higher-order fall sem umlykur async middleware með villumeðhöndlun.
 *
 * @param {function} fn Middleware sem grípa á villur fyrir
 * @returns {function} Middleware með villumeðhöndlun
 */
function catchErrors(fn) {
  return (req, res, next) => fn(req, res, next).catch(next);
}

async function productsGet(req, res) {
  const { order, category } = req.query;

  const result = await listCategories(order, category);

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

/**
 * Route handler fyrir lista af todods gegnum GET.
 *
 * @param {object} req Request hlutur
 * @param {object} res Response hlutur
 * @returns {array} Fylki af todos
 */
async function listRoute(req, res) {
  const { completed, order } = req.query;

  const todos = await listTodos(order, completed);

  return res.json(todos);
}

/**
 * Route handler til að búa til todo gegnum POST.
 *
 * @param {object} req Request hlutur
 * @param {object} res Response hlutur
 * @returns {object} Todo sem búið var til eða villur
 */
async function createRoute(req, res) {
  const { title, due, position } = req.body;

  const result = await createTodo({ title, due, position });

  if (!result.success) {
    return res.status(400).json(result.validation);
  }

  return res.status(201).json(result.item);
}

/**
 * Route handler fyrir stakt todo gegnum GET.
 *
 * @param {object} req Request hlutur
 * @param {object} res Response hlutur
 * @returns {object} Todo eða villa
 */
async function todoRoute(req, res) {
  const { id } = req.params;

  const todo = await readTodo(id);

  if (todo) {
    return res.json(todo);
  }

  return res.status(404).json({ error: 'Item not found' });
}

/**
 * Route handler til að breyta todo gegnum PATCH.
 *
 * @param {object} req Request hlutur
 * @param {object} res Response hlutur
 * @returns {object} Breytt todo eða villa
 */
async function patchRoute(req, res) {
  const { id } = req.params;
  const { title, due, position, completed } = req.body;

  const item = { title, due, position, completed };

  const result = await updateTodo(id, item);

  if (!result.success && result.validation.length > 0) {
    return res.status(400).json(result.validation);
  }

  if (!result.success && result.notFound) {
    return res.status(404).json({ error: 'Item not found' });
  }

  return res.status(201).json(result.item);
}

/**
 * Route handler til að eyða todo gegnum DELETE.
 *
 * @param {object} req Request hlutur
 * @param {object} res Response hlutur
 * @returns {object} Engu ef eytt, annars villu
 */
async function deleteRoute(req, res) {
  const { id } = req.params;

  const deleted = await deleteTodo(id);

  if (deleted) {
    return res.status(204).json({});
  }

  return res.status(404).json({ error: 'Item not found' });
}

router.get('/users/', catchErrors(usersGet));
router.get('/users/:id', catchErrors(usersGetId));
router.patch('/users/:id', catchErrors(usersPatchId));
router.post('/users/register', catchErrors(usersPostRegister));
router.post('/users/login', catchErrors(usersPostLogin));
router.get('/users/me', catchErrors(usersGetMe));
router.patch('/users/me', catchErrors(usersPatchMe));

router.get('/products/', catchErrors(productsGet));
router.get('/products/:id', catchErrors(productsGetId));
router.post('/products/', catchErrors(productsPost));
router.patch('/products/:id', catchErrors(productsPatch));
router.delete('/products/:id', catchErrors(productsDelete));
router.get('/categories/', catchErrors(categoriesGet));
router.get('/categories/:id', catchErrors(categoriesGetId));
router.post('/categories/', catchErrors(categoriesPost));
router.patch('/categories/:id', catchErrors(categoriesPatch));
router.delete('/categories/:id', catchErrors(categoriesDelete));


module.exports = router;
