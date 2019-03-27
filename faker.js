/* eslint-disable no-await-in-loop */
/* eslint-disable no-plusplus */
/* eslint-disable no-continue */
const faker = require('faker');
const fs = require('fs');

const { query } = require('./db');

async function main() {
  const productAmount = 1000;
  const categoryAmount = 12;
  const images = [];
  const categories = [];
  const products = [];
  // Byrjum á að tæma töflurnar áður en við setjum inn vörur
  await query('DELETE FROM products');
  await query('DELETE FROM categories');
  // Finnum mismunandi flokka fyrir vörur
  while (categories.length !== categoryAmount) {
    const cat = faker.commerce.department();
    if (!categories.includes(cat)) {
      categories.push(cat);
      await query('INSERT INTO categories (category) VALUES ($1)', [cat]);
    }
  }

  // lesum inn myndir í fylki
  fs.readdirSync('./img/').forEach((file) => {
    images.push(file);
  });

  while (products.length < productAmount) {
    const title = faker.commerce.productName();
    // Ef vara er nú þegar til þá reynum við aftur (continue)
    if (products.includes(title)) continue;
    products.push(title);
    const price = parseInt(faker.commerce.price(), 10);
    // þægilegra að hafa stuttan texta á meðan við erum að vinna verkefnið
    // Breyta: text = faker.lorem.paragraphs(); áður en við skilum
    const text = faker.lorem.paragraphs();
    const image = images[Math.floor(Math.random() * 20)];
    const category = categories[Math.floor(Math.random() * 12)];

    await query(`INSERT INTO products (title, price, text, imgurl, category)
    VALUES ($1 ,$2, $3, $4, $5)`, [title, price, text, image, category]);
  }
  console.log('Faker uppsett\nfjöldi mynda:', images.length,
    '\nfjöldi flokka:', categories.length,
    '\nfjöldi vara:', products.length);
}

main().catch((err) => {
  console.error(err);
});
