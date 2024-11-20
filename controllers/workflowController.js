const hubspot = require('@hubspot/api-client');
const { getAccessToken } = require('./hubspotController');  // Import the token logic
const axios = require('axios');
const { updateAPICount } = require('./CountLogics/packageConditionController');

exports.getAllObjects = async (req, res) => {
  try {
    const {portalId } = req.body; // Retrieve portalId from session
    if (!portalId) {
      return res.status(400).json({ error: 'Portal ID not found in session' });
    }

    // Retrieve the OAuth token for the portalId
    const accessToken = await getAccessToken(portalId);
    console.log('Access Token:', accessToken);

    // Fetch custom objects using the Schemas API
    const customObjectsResponse = await axios.get('https://api.hubapi.com/crm/v3/schemas', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    // Standard objects list
    const standardObjects = [
      { label: 'Contacts', value: 'contacts' },
      { label: 'Companies', value: 'companies' },
      { label: 'Deals', value: 'deals' },
      { label: 'Tickets', value: 'tickets' } // Include more standard objects if needed
    ];

    // Map custom objects from the API response
    const customObjects = customObjectsResponse.data.results.map((obj) => ({
      label: obj.name,
      value: obj.objectTypeId,
    }));

    // Combine standard and custom objects
    const allObjects = [...standardObjects, ...customObjects];

    // Format the response to include an "options" property
    const response = {
      options: allObjects
    };

    // Return the response as a JSON object
    console.log('All Objects:', response);
    res.status(200).json(response);
  } catch (error) {
    console.error('Error fetching objects:', error.message);
    res.status(500).json({ error: 'Error fetching objects.' });
  }
};



exports.getMultiSelectProperties = async (req, res) => {
  try {
    console.log("Request Body:", req.body);

    // Extract objectType and portalId from inputFields and request body
    const { inputFields, portalId } = req.body;
    const objectType = inputFields.objectTypeSelect?.value;

    // Validate objectType and portalId
    if (!objectType) {
      return res.status(400).json({ error: 'Missing object type parameter' });
    }
    if (!portalId) {
      return res.status(400).json({ error: 'Portal ID not provided in the request' });
    }

    // Retrieve the OAuth token for the portalId
    const accessToken = await getAccessToken(portalId);

    // Make the API request to fetch properties for the given object type
    const response = await axios.get(`https://api.hubapi.com/crm/v3/properties/${objectType}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    // Filter properties for 'checkbox' or 'select' field types
    const properties = response.data.results.filter(
      (property) => property.fieldType === 'checkbox' || property.fieldType === 'select'
    );

    // Check if there are no multi-select properties
    if (properties.length === 0) {
      return res.status(200).json({
        options: [
          {
            label: "No properties available",
            value: "None"
          }
        ]
      });
    }

    // Format the properties for the dropdown options
    const formattedProperties = properties.map((property) => ({
      label: property.label,
      value: property.name,
    }));

    res.status(200).json({ options: formattedProperties });
  } catch (error) {
    console.error('Error fetching multi-select properties:', error.message);
    res.status(500).json({ error: 'Error fetching multi-select properties.' });
  }
};




exports.getPropertyOptions = async (req, res) => {
  try {
    console.log('Request Body:', req.body);

    // Extract portalId and inputFields from the request body
    const { inputFields, portalId } = req.body;
    const objectType = inputFields.objectTypeSelect?.value;
    const propertyName = inputFields.multiSelectProperty?.value;

    // Validate portalId, objectType, and propertyName
    if (!portalId) {
      return res.status(400).json({ error: 'Portal ID not provided in the request' });
    }
    if (!objectType || !propertyName) {
      return res.status(400).json({ error: 'Object type or property name is missing' });
    }

    // Retrieve the OAuth token for the portalId
    const accessToken = await getAccessToken(portalId);
    const hubspotClient = new hubspot.Client();
    hubspotClient.setAccessToken(accessToken);

    // Fetch the specific property details from HubSpot
    const propertyResponse = await hubspotClient.crm.properties.coreApi.getByName(objectType, propertyName);

    // Access the property directly from propertyResponse
    const property = propertyResponse;

    console.log('Property:', property);

    // Check if the property and its options exist
    if (!property || !property.options || property.options.length === 0) {
      return res.status(200).json({
        options: [
          {
            label: "No option available",
            value: "None"
          }
        ]
      });
    }

    // Filter out hidden options if needed
    const visibleOptions = property.options.filter(option => !option.hidden);

    // Check if there are any visible options
    if (visibleOptions.length === 0) {
      return res.status(200).json({
        options: [
          {
            label: "No option available",
            value: "None"
          }
        ]
      });
    }

    // Format the visible options into an array with label and value
    const options = visibleOptions.map(option => ({
      label: option.label || 'Unnamed Option',
      value: option.value
    }));

    res.status(200).json({ options });
  } catch (error) {
    console.error('Error fetching property options:', error.message);
    res.status(500).json({ error: 'Error fetching property options.' });
  }
};


exports.removePropertyOption = async (req, res) => {
  try {
    console.log("req body for remove", req.body);
    // Extract necessary fields from the request body
    const portalId = req.body.origin.portalId;
    const { objectId } = req.body.object;
    const { inputFields } = req.body;
    const propertyName = inputFields.multiSelectProperty;
    const optionValueToRemove = inputFields.optionToRemove;
    const objectType = inputFields.objectTypeSelect;
    //updateAPICount(portalId); //will open later
    // Validate input
    if (!portalId) {
      return res.json({
        outputFields: { message: 'Portal ID not provided in the request' }
      });
    }
    if (!objectId || !objectType || !propertyName || !optionValueToRemove) {
      return res.json({
        outputFields: { message: 'Missing required parameters' }
      });
    }

    // Retrieve the OAuth token for the portalId
    const accessToken = await getAccessToken(portalId);
    if (!accessToken) {
      return res.json({
        outputFields: { message: 'Failed to retrieve access token' }
      });
    }

    // Initialize HubSpot client with the access token
    const hubspotClient = new hubspot.Client({ accessToken });

    // Use the appropriate HubSpot API client based on the object type
    let objectApi;
    if (objectType === 'contacts') {
      objectApi = hubspotClient.crm.contacts.basicApi;
    } else if (objectType === 'deals') {
      objectApi = hubspotClient.crm.deals.basicApi;
    } else if (objectType === 'companies') {
      objectApi = hubspotClient.crm.companies.basicApi;
    } else {
      return res.json({
        outputFields: { message: `Unsupported object type: ${objectType}` }
      });
    }

    // Fetch the current property value for the specific object
    const objectResponse = await objectApi.getById(objectId, [propertyName]);
    console.log('response------',objectResponse)
    const currentPropertyValue = objectResponse.properties[propertyName];
    console.log('current===========',currentPropertyValue)
    if (!currentPropertyValue) {
      return res.json({
        outputFields: { message: `Property ${propertyName} not found on the object` }
      });
    }

    // Split the current multi-select values into an array
    let valuesArray = currentPropertyValue.split(';');
    console.log('valuesArray===========',valuesArray)
    // Remove the specified option value
    valuesArray = valuesArray.filter(value => value.trim() !== optionValueToRemove.trim());
    console.log('valuesArray  2===========',valuesArray)
    // Join the values back into a string
    const updatedPropertyValue = valuesArray.join(';');
    console.log('updatedPropertyValue===========',updatedPropertyValue)
    // Prepare the properties to update
    const properties = {
      [propertyName]: updatedPropertyValue
    };

    // Update the object with the new property value
    await objectApi.update(objectId, { properties });

    // Respond with a success message
    res.json({ outputFields: { message: 'Option value removed successfully' } });
  } catch (error) {
    console.error('Error removing option value:', error.message);
    res.json({
      outputFields: { message: 'Error removing option value: ' + error.message }
    });
  }
};





