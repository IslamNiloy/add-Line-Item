const express = require('express');
const router = express.Router();
const { associateToDeal,fetchAllProductsNew} = require('../controllers/lineItemController'); 

router.post('/association', associateToDeal);
router.post('/get-product',fetchAllProductsNew);



module.exports = router;
