export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  try {
    const { to, message } = JSON.parse(event.body || '{}');

    if (!to || !message) {
       return {
         statusCode: 400,
         body: JSON.stringify({ error: 'Missing required fields' })
       };
    }

    const apiKey = process.env.AT_API_KEY;
    const username = process.env.AT_USERNAME || "sandbox";

    if (!apiKey) {
      console.warn("AT_API_KEY is not set. Simulating SMS sending.");
      return {
        statusCode: 200,
        body: JSON.stringify({
          SMSMessageData: {
            Message: "Sent to the void (Simulation mode)",
            Recipients: to.map((num) => ({ statusCode: 101, number: num, status: "Success", cost: "0" }))
          }
        })
      };
    }

    const africastalkingModule = await import('africastalking');
    const africastalking = africastalkingModule.default || africastalkingModule;
    const AT = africastalking({ apiKey, username });
    
    // Convert to Array if it's a string somehow
    const toArray = Array.isArray(to) ? to : [to];

    const result = await AT.SMS.send({
      to: toArray,
      message,
    });

    return {
      statusCode: 200,
      body: JSON.stringify(result),
    };
  } catch (error) {
    console.error("SMS sending error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || 'Failed to send SMS' }),
    };
  }
};
