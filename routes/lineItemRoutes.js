const express = require('express');
const router = express.Router();
const { associateToDeal,fetchAllProductsNew, fetchProductPrice} = require('../controllers/lineItemController'); 

router.post('/association', associateToDeal);
router.post('/get-product',fetchAllProductsNew);
router.get('/get-product-price', fetchProductPrice);



module.exports = router;
