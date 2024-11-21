const express = require('express');
const router = express.Router();
const { associateToDeal,fetchAllProductsNew, fetchProductPrice} = require('../controllers/lineItemController'); 

router.post('/association', associateToDeal);
router.post('/get-product',fetchAllProductsNew);
router.post('/get-product-price', fetchProductPrice);



module.exports = router;
