
const User = require('../../models/user');
const Subscription = require('../../models/subscription');
  
const countBuffer = {};  // In-memory buffer to store increments per user
const FLUSH_INTERVAL = 5000;  // Flush buffer every 5 seconds

// Periodically flush buffer to database
setInterval(async () => {
    for (const [userId, counts] of Object.entries(countBuffer)) {
        try {
            await Subscription.findOneAndUpdate(
                { user: userId },
                { $inc: { apiCallCount: counts.apiCalls, 
                          totalApiCallCount: counts.totalApiCalls,

                          }},
                { new: true, upsert: false }
            );
            delete countBuffer[userId];  // Clear buffer for the user after updating
        } catch (error) {
            console.error(`Failed to update user ${userId}:`, error);
        }
    }
}, FLUSH_INTERVAL);

exports.updateAPICount = async (portalId) => {
    try {
        // Log start
        // logger.info("---------------------logging at update API Count start-------------------");
        // logger.info("Portal id: " + portalID);

        // Find user directly in Subscription, if possible, or find user ID from User model
        const user = await User.findOne({ portalId: portalId });
        if (!user) {
            console.log('User not found in updateAPICount: '+ portalId);
            return;
        }

        // Buffer API count increments for the user
        if (!countBuffer[user._id]) {
            countBuffer[user._id] = { apiCalls: 0, totalApiCalls: 0 };
        }
        countBuffer[user._id].apiCalls += 1;
        countBuffer[user._id].totalApiCalls += 1;
        console.log(`countBuffer[user._id].apiCalls =  ${countBuffer[user._id].apiCalls}`);
        console.log(`countBuffer[user._id].totalApiCalls =  ${countBuffer[user._id].totalApiCalls}`);
    } catch (error) {
        console.error('Error in updateAPICount function:', error);
    }
};

  
  // exports.packageCondition = async (portalID) => {
  //   try{
  //     const user = await User.findOne( {portalID: portalID});
  //     // logger.info("At packageCondition user infos: "+ user);
  //     if (!user) {
  //       // Handle case where user is not found
  //       return false;
  //     }
  //     //this user's subscription subscription
  //     const subscription = await Subscription.findOne( {user: user._id});
  //     //This user's package
  //     const user_package = await Package.findOne( {_id: subscription.package});
  //     const today = new Date();
  //     if (today >  (subscription.packageEndDate)) {
  //       return false;
  //     }
      
  //     if(subscription && user_package){
  //       const totalAPICALLS = parseInt(subscription.apiCallCount) + parseInt(subscription.checkPhoneNumberApiCallCount)
  //       console.log("Returning totalAPICALLS count:" + totalAPICALLS);
  //       if(totalAPICALLS < user_package.Limit){
  //         console.log("Returning true when total API is:" + totalAPICALLS);
  //         return true;
  //       }else{
  //         console.log("Returning false when total API is::" + totalAPICALLS);
  //         return false;
  //       }
  //     }else{
  //       console.log("Returning false due to subscription infor not found");
  //       return false;
  //     }
 
  //   }catch (e) {
  //     logger.error("error in condition function: " + e);
  //   }
  // }