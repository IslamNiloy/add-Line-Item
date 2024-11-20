const express = require('express');
const router = express.Router();
const { getAllObjects,removePropertyOption} = require('../controllers/workflowController'); 
const { getMultiSelectProperties, getPropertyOptions } = require('../controllers/workflowController');

router.post('/get-multiselect-properties', getMultiSelectProperties);
router.post('/get-all-objects', getAllObjects); 

router.post('/get-property-options',getPropertyOptions);
router.post ('/remove-property-option',removePropertyOption)


module.exports = router;
