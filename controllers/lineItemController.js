
const hubspot = require('@hubspot/api-client');
const { getAccessToken } = require('./hubspotController');  // Import the token logic
const axios = require('axios');


exports.associateToDeal = async (req, res) => {
    console.log('Associations: ', req.body);

    // Extract portalId from the request body
    const portalId = req.body.origin?.portalId;
    if (!portalId) {
        return res.status(400).json({ error: 'Portal ID not found in request body' });
    }

    // Retrieve the OAuth token for the portalId
    const accessToken = await getAccessToken(portalId);
    const hubspotClient = new hubspot.Client();
    hubspotClient.setAccessToken(accessToken);

    // Extract dealId from the request body
    const dealId = req.body.object?.objectId;
    if (!dealId) {
        return res.status(400).json({ error: 'Deal ID not found in request body' });
    }

    // Extract fields from the request body
    const fields = req.body.fields || req.body.inputFields;
    const selectedProduct = fields.productSelect;
    const unitPriceOption = fields.unitPrice;
    const customUnitPrice = fields.customUnitPrice;
    const quantity = parseInt(fields.quantity) || 1;
    const discountType = fields.discountType;
    const discountPercentage = parseFloat(fields.discountPercentage) || 0;
    const discountPrice = parseFloat(fields.discountPrice) || 0;
    const updateDealAmount = fields.updateDealAmount;

    // Determine the unit price
    let unitPrice = 0;
    if (unitPriceOption === 'custom') {
        unitPrice = parseFloat(customUnitPrice) || 0;
    } else {
        unitPrice = parseFloat(unitPriceOption) || 0;
    }

    // Calculate the discount
    let discountAmount = 0;
    if (discountType === 'percentage' && discountPercentage > 0) {
        discountAmount = (unitPrice * discountPercentage) / 100;
    } else if (discountType === 'price' && discountPrice > 0) {
        discountAmount = discountPrice;
    }

    // Prepare properties for the line item
    const properties = {
        "hs_product_id": selectedProduct,
        "quantity": quantity,
        "price": unitPrice,
        "discount":discountAmount
    };

    if (discountType === 'percentage' && discountPercentage > 0) {
        properties.discount_percentage = discountPercentage.toFixed(2);
    } else if (discountType === 'price' && discountPrice > 0) {
        properties.discount_amount = discountPrice.toFixed(2);
    }

    // Prepare the line item input with associations
    const lineItemInput = {
        properties,
        associations: [
            {
                to: { id: dealId },
                types: [
                    {
                        associationCategory: "HUBSPOT_DEFINED",
                        associationTypeId: 20 // Line item to deal association type
                    }
                ]
            }
        ]
    };

    try {
        // Create the line item and associate it with the deal
        await hubspotClient.crm.lineItems.basicApi.create(lineItemInput);

        // Update the deal amount if specified
        if (updateDealAmount === 'yes') {
            // Fetch the current deal amount
            const dealResponse = await hubspotClient.crm.deals.basicApi.getById(dealId, ['amount']);
            console.log(dealResponse)
            const currentDealAmount = parseFloat(dealResponse.properties.amount) || 0;

            // Calculate the total for the line item
            const lineItemTotal = (unitPrice - discountAmount) * quantity;

            // Update the deal amount
            const updatedAmount = currentDealAmount + lineItemTotal;
            await hubspotClient.crm.deals.basicApi.update(dealId, {
                properties: {
                    amount: updatedAmount.toFixed(2)
                }
            });
        }

        res.status(200).json({
            "outputFields": {
                "message": "Success",
                "hs_execution_state": "SUCCESS"
            }
        });
    } catch (e) {
        console.error(e.message === 'HTTP request failed' ? JSON.stringify(e.response, null, 2) : e);
        res.status(500).json({
            "outputFields": {
                "hs_execution_state": "An error occurred while creating the line item or updating the deal amount."
            }
        });
    }
};




exports.fetchAllProductsNew = async (req, res) => {
    console.log("Fetch All Product : ",req.body);
    // Handle CORS headers
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    
    // Retrieve the request payload
    const { fetchOptions, inputFieldName, origin, objectTypeId, inputFields } = req.body;

    const {portalId } = req.body; // Retrieve portalId from session
    if (!portalId) {
      return res.status(400).json({ error: 'Portal ID not found in session' });
    }
    // Retrieve the OAuth token for the portalId
    const accessToken = await getAccessToken(portalId);
    // console.log('Access Token:', accessToken);
    const hubspotClient = new hubspot.Client();
    hubspotClient.setAccessToken(accessToken);

    let allProducts = [];
    let after = fetchOptions?.after || undefined; // Handle pagination cursor
    const limit = 100; // Adjust this as necessary for your pagination

    try {
        // Fetch products from HubSpot
        do {
            const productPage = await hubspotClient.crm.products.basicApi.getPage(limit, after);
            const products = productPage.results;
            console.log(products);

            // Map products into the expected format
            const productList = products.map(product => ({
                "label": product.properties.name,
                "description": product.properties.name,
                "value": product.id,
                "unitPrice":product.properties.price
            }));

            allProducts = allProducts.concat(productList);
            after = productPage.paging ? productPage.paging.next.after : undefined;

            // Handle filtering based on search query
            if (fetchOptions?.q) {
                const query = fetchOptions.q.toLowerCase();
                allProducts = allProducts.filter(product =>
                    product.label.toLowerCase().includes(query)
                );
            }
        } while (after);

        // Send back the response with the product options
        res.status(200).json({
            "options": allProducts,  // The options that HubSpot will use for the dropdown
            "after": after || undefined,  // Handle pagination if there is a next page
            "searchable": true  // Allow the user to search the options
        });
    } catch (e) {
        console.error(e.message === 'HTTP request failed' ? JSON.stringify(e.response, null, 2) : e);
        res.status(500).json({
            "options": "hs_execution_state An error occurred while fetching the products."
        });
    }
};


exports.fetchProductPrice = async (req, res) => {
    console.log("Fetch Product Price: ", req.body);

    // Retrieve the input fields and portalId from the request body
    const { inputFields, portalId } = req.body;
    const productId = inputFields.productSelect?.value;

    if (!portalId) {
        return res.status(400).json({ error: 'Portal ID is required' });
    }

    // Retrieve the OAuth token for the portalId
    const accessToken = await getAccessToken(portalId);
    if (!accessToken) {
        return res.status(403).json({ error: 'Access token not found for the portal' });
    }

    const hubspotClient = new hubspot.Client();
    hubspotClient.setAccessToken(accessToken);

    try {
        // Define default options array
        const options = [
            {
                label: "Custom",
                value: "custom"
            }
        ];

        if (productId && productId !== "custom") {
            // Fetch the product details from HubSpot if a product ID is selected
            const product = await hubspotClient.crm.products.basicApi.getById(productId);

            if (!product || !product.properties) {
                return res.status(404).json({ error: 'Product not found' });
            }

            // Extract the unit price
            const unitPrice = product.properties.price;

            // Add the fetched product price to the options
            options.push({
                label: unitPrice,
                value: unitPrice.toString()
            });
        }

        // Respond with the options array
        res.status(200).json({ options });
    } catch (error) {
        console.error('Error fetching product price:', error.message || error);
        res.status(500).json({ error: 'An error occurred while fetching the product price' });
    }
};

