/*
 *
 *
 *       Complete the API routing below
 *
 *
 */

'use strict';

const https = require('https');
const axios = require('axios');
const { promises } = require('fs');

const writeConcern = {
  writeConcern: {
    w: 'majority',
    j: true,
    wtimeout: 1000,
  },
};

// Fetch data
function fetchData(stock) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'stock-price-checker-proxy.freecodecamp.rocks',
      port: 443,
      path: `/v1/stock/${stock}/quote`,
      method: 'GET',
      headers: {
        // Without User-Agent, will get 403 Forbidden status code.
        'User-Agent': 'request',
      },
    };

    const req = https.get(options, (res) => {
      res.setEncoding('utf-8');
      let responseBody = '';

      // called when a data chunk is received.
      res.on('data', (chunk) => {
        responseBody += chunk;
      });

      // called when the complete response is received.
      res.on('end', () => {
        resolve(JSON.parse(responseBody));
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.end();
  });
}

module.exports = (app, db) => {
  app.route('/api/stock-prices').get(async (req, res, next) => {
    const { stock, like } = req.query;
    // Client ip
    const ip = req.ip;

    // 1 stock without like field
    if (!Array.isArray(stock) && !like) {
      try {
        // Fetch stock info from API
        const { symbol, latestPrice } = await fetchData(stock);

        // Check if stock already exists in db
        const doc = await db.collection('stocks').findOne({ stock: symbol });

        let stockLikes = 0;

        // If found, get stored likes
        if (doc) {
          stockLikes = doc.likedUsers.length;
        } else {
          // Add stock ticker and an empty likedUsers array to db
          const { insertedCount } = await db.collection('stocks').insertOne(
            {
              stock: symbol,
              likedUsers: [],
            },
            writeConcern
          );
          if (insertedCount !== 1) {
            throw new Error();
          }
        }
        return res.json({
          stockData: {
            stock: symbol,
            price: String(latestPrice),
            likes: stockLikes,
          },
        });
      } catch (err) {
        return next(err);
      }
    }

    // 1 Stock with like field
    if (!Array.isArray(stock) && like) {
      try {
        // Fetch stock info from API
        const response = await axios.get(
          `https://repeated-alpaca.glitch.me/v1/stock/${stock}/quote`
        );
        const { symbol, latestPrice } = response.data;

        // Find the stock in db, and add liked user's ip to db if it does not already exists.
        const { value } = await db.collection('stocks').findOneAndUpdate(
          { stock: symbol },
          {
            $addToSet: { likedUsers: ip },
          },
          {
            returnOriginal: false,
            // If the stock is not in db, insert a new document.
            upsert: true,
            ...writeConcern,
          }
        );

        if (value) {
          return res.json({
            stockData: {
              stock: symbol,
              price: String(latestPrice),
              likes: value.likedUsers.length,
            },
          });
        } else {
          throw new Error();
        }
      } catch (err) {
        return next(err);
      }
    }

    // 2 stocks without like field
    if (Array.isArray(stock) && !like) {
      try {
        // Fetch each stock info from API
        const stocks = await Promise.all(stock.map((item) => fetchData(item)));

        // Store each stock likes in order to calculate the difference between the likes
        const stocksLikes = [];

        for (const stock of stocks) {
          // Find stock in db
          const doc = await db
            .collection('stocks')
            .findOne({ stock: stock.symbol });

          // If stock in db, get likes and push its value into stocksLikes array
          if (doc) {
            stocksLikes.push(doc.likedUsers.length);
          } else {
            // If stock not in db, push 0 into stocksLikes array
            stocksLikes.push(0);
            // Add stock to db
            const { insertedCount } = await db
              .collection('stocks')
              .insertOne({ stock: stock.symbol, likedUsers: [] }, writeConcern);

            if (insertedCount !== 1) {
              throw new Error();
            }
          }
        }

        return res.json({
          stockData: [
            {
              stock: stocks[0].symbol,
              price: String(stocks[0].latestPrice),
              rel_likes: stocksLikes[0] - stocksLikes[1],
            },
            {
              stock: stocks[1].symbol,
              price: String(stocks[1].latestPrice),
              rel_likes: stocksLikes[1] - stocksLikes[0],
            },
          ],
        });
      } catch (err) {
        return next(err);
      }
    }

    // 2 stocks with like field
    if (Array.isArray(stock) && like) {
      try {
        // Fetch each stock info from API
        const stocks = await Promise.all(stock.map((item) => fetchData(item)));

        // Store each stock likes for calculating the difference between the likes
        const stocksLikes = [];

        for (const stock of stocks) {
          // Find each stock in db, add user ip to db if it does not already exist.
          const { value } = await db.collection('stocks').findOneAndUpdate(
            { stock: stock.symbol },
            { $addToSet: { likedUsers: ip } },
            {
              returnOriginal: false,
              // If query doesn't match, add the stock into db
              upsert: true,
              ...writeConcern,
            }
          );

          if (value) {
            // Add likes to stocksLikes array
            stocksLikes.push(value.likedUsers.length);
          } else {
            throw new Error();
          }
        }

        res.json({
          stockData: [
            {
              stock: stocks[0].symbol,
              price: String(stocks[0].latestPrice),
              rel_likes: stocksLikes[0] - stocksLikes[1],
            },
            {
              stock: stocks[1].symbol,
              price: String(stocks[1].latestPrice),
              rel_likes: stocksLikes[1] - stocksLikes[0],
            },
          ],
        });
      } catch (err) {
        next(err);
      }
    }
  });
};
