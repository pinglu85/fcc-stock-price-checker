/*
 *
 *
 *       FILL IN EACH FUNCTIONAL TEST BELOW COMPLETELY
 *       -----[Keep the tests in the same order!]-----
 *       (if additional are added, keep them at the very end!)
 */

const chaiHttp = require('chai-http');
const chai = require('chai');
const assert = chai.assert;
const server = require('../server');
const url = '/api/stock-prices';

chai.use(chaiHttp);

suiteSetup((done) => {
  server.on('ready', () => {
    done();
  });
});

suite('Functional Tests', () => {
  suite('GET /api/stock-prices => stockData object', () => {
    test('1 stock', (done) => {
      chai
        .request(server)
        .get(url)
        .query({ stock: 'goog' })
        .end((err, res) => {
          assert.equal(res.status, 200);
          assert.property(res.body, 'stockData');
          assert.isObject(res.body.stockData);
          assert.propertyVal(res.body.stockData, 'stock', 'GOOG');
          assert.property(res.body.stockData, 'price');
          assert.property(res.body.stockData, 'likes');
          assert.isString(res.body.stockData.price);
          assert.isNumber(res.body.stockData.likes);
          done();
        });
    });

    test('1 stock with like', (done) => {
      chai
        .request(server)
        .get(url)
        .query({ stock: 'MSFT', like: 'true' })
        .end((err, res) => {
          assert.equal(res.status, 200);
          assert.property(res.body, 'stockData');
          assert.isObject(res.body.stockData);
          assert.propertyVal(res.body.stockData, 'stock', 'MSFT');
          assert.property(res.body.stockData, 'price');
          assert.propertyVal(res.body.stockData, 'likes', 1);
          done();
        });
    });

    test("1 stock with like again (ensure likes aren't double counted)", (done) => {
      chai
        .request(server)
        .get(url)
        .query({ stock: 'MSFT', like: 'true' })
        .end((err, res) => {
          assert.equal(res.status, 200);
          assert.propertyVal(res.body.stockData, 'stock', 'MSFT');
          assert.propertyVal(res.body.stockData, 'likes', 1);
          done();
        });
    });

    test('2 stocks', (done) => {
      chai
        .request(server)
        .get(url)
        .query({ stock: ['GOOG', 'AAPL'] })
        .end((err, res) => {
          const regex = /^(GOOG|AAPL)$/;
          assert.equal(res.status, 200);
          assert.property(res.body, 'stockData');
          assert.isArray(res.body.stockData);
          res.body.stockData.forEach((stock) => {
            assert.isObject(stock);
            assert.property(stock, 'stock');
            assert.property(stock, 'price');
            assert.property(stock, 'rel_likes');
            assert.match(stock.stock, regex);
            assert.isNumber(stock.rel_likes);
          });
          done();
        });
    });

    test('2 stocks with like', (done) => {
      chai
        .request(server)
        .get(url)
        .query({ stock: ['NFLX', 'AMZN'], like: 'true' })
        .end((err, res) => {
          const regex = /^(NFLX|AMZN)$/;
          assert.equal(res.status, 200);
          assert.isArray(res.body.stockData);
          res.body.stockData.forEach((stock) => {
            assert.equal(res.status, 200);
            res.body.stockData.forEach((stock) => {
              assert.match(stock.stock, regex);
              assert.propertyVal(stock, 'rel_likes', 0);
            });
          });
          done();
        });
    });
  });
});
