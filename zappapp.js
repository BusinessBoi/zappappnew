import "dotenv/config";
import express from 'express';
import pkg from 'twilio';
import OpenAI from "openai";

const { Twilio } = pkg;

// Initialize Express and Twilio client
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const twilioClient = new Twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Twilio WhatsApp webhook endpoint
app.post('/whatsapp', async (req, res) => {
    const incomingMsg = req.body.Body; // The message received from WhatsApp
    const from = req.body.From; // Sender's WhatsApp number

    try {
        // Assuming you've already set up an assistant in OpenAI and retrieved its ID
        const thread = await openai.beta.threads.create();
        await openai.beta.threads.messages.create(thread.id, {
            role: "user",
            content: incomingMsg
        });
        const run = await openai.beta.threads.runs.create(thread.id, { assistant_id: "asst_LAi3M1Lo1iVOBVKgIFcjkKFQ" });

        let runStatus;
        let retries = 3; // Number of retries
        do {
            await new Promise(resolve => setTimeout(resolve, 1000));
            runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
            retries--;
        } while (retries > 0 && (runStatus === null || runStatus.status !== "completed"));

        if (runStatus && runStatus.status === "completed") {
            const messages = await openai.beta.threads.messages.list(thread.id);
            const reply = messages.data.find(m => m.role === "assistant")?.content;

            if (typeof reply === 'string' && reply.trim().length > 0) {
                // Send the OpenAI response back to the sender via Twilio
                await twilioClient.messages.create({
                    body: reply,
                    from: 'whatsapp:+14155238886', // Your Twilio WhatsApp number
                    to: from
                });
                res.status(200).send('Message processed');
            } else {
                console.error('Error: Empty or whitespace reply from OpenAI.');
                res.status(200).send('Received empty response from OpenAI, no message sent.');
            }
        } else {
            console.error('Error: No reply from OpenAI after retries.');
            res.status(200).send('No response from OpenAI, no message sent.');
        }
    } catch (error) {
        console.error("Error processing WhatsApp message:", error);
        res.status(500).send('Internal Server Error');
    }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
