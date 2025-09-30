const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 80;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Conexión sin base de datos (para poder crearla si no existe)
const rootDb = mysql.createConnection({
  host: 'localhost',
  port: 3306,
  user: 'root',       // ⚠️ reemplazar
  password: 'Sanlorenzo2003'   // ⚠️ reemplazar
});

rootDb.connect(err => {
  if (err) {
    console.error('Error conectando a MySQL:', err);
    process.exit(1);
  }
  console.log('Conectado a MySQL (root connection)');

  // Crear base de datos si no existe
  rootDb.query('CREATE DATABASE IF NOT EXISTS products_db', (err) => {
    if (err) throw err;
    console.log('Base de datos products_db creada/verificada');

    // Conectar ahora sí a la DB products_db
    const db = mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: 'Sanlorenzo2003',
      database: 'products_db'
    });

    db.connect(err => {
      if (err) {
        console.error('Error conectando a products_db:', err);
        process.exit(1);
      }
      console.log('Conectado a products_db');

      // Crear tabla en memoria
      const createTableQuery = `
        CREATE TABLE IF NOT EXISTS products (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          category VARCHAR(255) NOT NULL,
          quantity INT NOT NULL,
          price DECIMAL(10,2) NOT NULL,
          description VARCHAR(500),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=MEMORY;
      `;
      db.query(createTableQuery, (err) => {
        if (err) throw err;
        console.log('Tabla products creada en memoria');

        // Insertar datos de ejemplo si está vacía
        const sampleProducts = [
          ['Laptop Pro', 'Electronics', 15, 1299.99, 'High-performance laptop'],
          ['Wireless Mouse', 'Electronics', 45, 29.99, 'Ergonomic wireless mouse'],
          ['Office Chair', 'Furniture', 8, 199.99, 'Comfortable office chair'],
          ['Coffee Beans', 'Food', 120, 12.99, 'Premium coffee beans'],
          ['Notebook Set', 'Office Supplies', 200, 8.99, 'Pack of 3 notebooks']
        ];

        db.query('SELECT COUNT(*) AS count FROM products', (err, result) => {
          if (err) throw err;
          if (result[0].count === 0) {
            const sql = 'INSERT INTO products (name, category, quantity, price, description) VALUES ?';
            db.query(sql, [sampleProducts], (err) => {
              if (err) throw err;
              console.log('Datos de ejemplo insertados en tabla MEMORY');
            });
          }
        });
      });

      // ---------------- API Routes ----------------
      app.get('/api/products', (req, res) => {
        db.query('SELECT * FROM products ORDER BY created_at DESC', (err, rows) => {
          if (err) return res.status(500).json({ error: err.message });
          res.json(rows);
        });
      });

      app.get('/api/products/:id', (req, res) => {
        const { id } = req.params;
        db.query('SELECT * FROM products WHERE id = ?', [id], (err, rows) => {
          if (err) return res.status(500).json({ error: err.message });
          if (rows.length === 0) return res.status(404).json({ error: 'Product not found' });
          res.json(rows[0]);
        });
      });

      app.post('/api/products', (req, res) => {
        const { name, category, quantity, price, description } = req.body;
        if (!name || !category || quantity === undefined || price === undefined) {
          return res.status(400).json({ error: 'Missing required fields' });
        }
        const sql = 'INSERT INTO products (name, category, quantity, price, description) VALUES (?, ?, ?, ?, ?)';
        db.query(sql, [name, category, quantity, price, description], (err, result) => {
          if (err) return res.status(500).json({ error: err.message });
          res.json({ id: result.insertId, message: 'Product created successfully' });
        });
      });

      app.put('/api/products/:id', (req, res) => {
        const { id } = req.params;
        const { name, category, quantity, price, description } = req.body;
        const sql = `
          UPDATE products
          SET name = ?, category = ?, quantity = ?, price = ?, description = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `;
        db.query(sql, [name, category, quantity, price, description, id], (err, result) => {
          if (err) return res.status(500).json({ error: err.message });
          if (result.affectedRows === 0) return res.status(404).json({ error: 'Product not found' });
          res.json({ message: 'Product updated successfully' });
        });
      });

      app.delete('/api/products/:id', (req, res) => {
        const { id } = req.params;
        db.query('DELETE FROM products WHERE id = ?', [id], (err, result) => {
          if (err) return res.status(500).json({ error: err.message });
          if (result.affectedRows === 0) return res.status(404).json({ error: 'Product not found' });
          res.json({ message: 'Product deleted successfully' });
        });
      });

      app.get('/api/stats', (req, res) => {
        const sql = `
          SELECT 
            COUNT(*) as total_products,
            SUM(quantity) as total_items,
            COUNT(DISTINCT category) as categories,
            SUM(quantity * price) as total_value
          FROM products
        `;
        db.query(sql, (err, rows) => {
          if (err) return res.status(500).json({ error: err.message });
          res.json(rows[0]);
        });
      });
    });
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
