//there will be a new record for every user
const mongoose = require('mongoose');
const ObjectId = require('mongodb').ObjectId;

const SubscriptionSchema = new mongoose.Schema({
    user: {
        type: ObjectId,
        ref: 'User',
        unique: true
    },
    portalID: { type: Number, require: true, unique: true },
    limit: {type: Number}, //From package, actual limit of the package
    apiCallCount: {type: Number},
    packageId: {type: String},
    totalApiCallCount: { type: Number },
    monthAPICallCount: {type: Number},
    hubspotDealId: { type: String },
    packageUpgradeDate: {type: Date},
    packageDowngradeDate: {type: Date},
    packagePrice: {type: Number},
    lastAppUsageDate: {type: Date},
    usagePercentage: {type: Number},
    joiningDate: { type: Date },
    packageStartDate: { type: Date },
    packageEndDate: { type: Date },
    apiCallLimit: { type: Number } //if custom
},
    {
        timestamps: true,
    });

module.exports = mongoose.model('Subscription', SubscriptionSchema);