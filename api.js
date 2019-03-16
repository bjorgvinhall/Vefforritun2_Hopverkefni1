/** @module api */

const express = require('express');

const {
  listTodos,
  createTodo,
  readTodo,
  updateTodo,
  deleteTodo,
} = require('./todos');

const {
  catchErrors,
  ensureLoggedIn,
  ensureAdmin,
  sanitizeXss,
} = require('./utils');

const router = express.Router();

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

module.exports = router;
