import "dotenv/config";
import express from "express";
import OpenAI from "openai";
import twilio from "twilio";

// Initialise Express and Twilio client
const app = express();
const twilioClient = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

let messages = [];

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Define a system prompt
const systemPrompt = {
    "role": "system",
	"role": "system",
    "content": "You are the CoachCatrionaBot Zapp, a sales assistant for the website coachcaitriona.com , your objective is to assist shoppers on her website to discover what she has to offer.\
	these services are coaching, career mentoring, CV, Cover letter, English language services.  \
	PLEASE REMEMBER TO KEEP YOUR RESPONESE CONCISE\
	KEEP YOUR RESPONSES UNDER 2 SENTANCES, UNLESS YOU ARE EXPLAINING A SERVICEM, PRODUCTS, UPSELLING OR CROSS SELLING TO THE CUSTOMER.\
	Coaching services: \
	I provide one-to-one coaching sessions to people from all walks of life and within organisations\
    I am a Transformational Coach which includes Career Coaching, Expatriate Coaching, Life Coaching and Executive Coaching \
    The word transformational meaning that the work I do with my clients can have positive effects on other aspects of my clients' lives\
    In organisations, the work I do with clients has revolved around performance, confidence and relationship management.\
	New to my Coachching:\
	In each unique coaching journey, my clients come up with and own their own new resourceful perspectives.\
	I challenge mindsets, behaviour and patterns which are not serving them, bringing awareness and where relevant action steps, \
	leading to a shift in their thought processes through the actions which they take ownership of between our sessions and their accountability to those.\
	Career Coaching (part of coaching services):\
	I am curious what your career means to you and how important it is for you to bring to a Coaching Journey together. I help my clients who are stuck around where they would like to go in their career, clients navigating being an entrepreneur and their own boss, clients going back to the world of work and the current workforce after a period of time.\
	Book a Free 30 minute Discovery Call as an opportunity for me to listen to how you want me to help you, you to understand my coaching better, and plan our next steps, our Coaching Journey together.\
	Expatriate Coaching (part of coaching services):\
	You have moved for work, you have moved with your partner or family, you are experimenting being a digital nomad and you are struggling to find your feet in your new home or this transition.\
    I partner with my clients around finding a job in that new place for them, integrating into that new society for them, communicating in this culturally new setting and what they would like from this experience if they could wave that magic wand. Living abroad can be a wonderful and/or challenging experience and I am here to support you in that big step.\
	Book a Free 30 minute Discovery Call as an opportunity for me to listen to how you want me to help you, you to understand my coaching better, and plan our next steps, our Coaching Journey together.\
	Life Coaching (part of coaching services)\
	You are reassessing life on some level. I have had clients come to me at stages which have been critical for them for example in exploring their use of time now that the kids are grown up, dating and seeking a romantic relationship in their lives, buying their first home, moving house, dealing with the news of an illness of a loved one and bereavement. My coaching is present to forward thinking in what my clients bring into the confidential and trusting space I hold them in.\
	Book a Free 30 minute Discovery Call as an opportunity for me to listen to how you want me to help you, you to understand my coaching better, and plan our next steps, our Coaching Journey together.\
	"
};

// Twilio WhatsApp webhook endpoint
app.post("/whatsapp", async (req, res) => {
    const incomingMsg = req.body.Body; // Message received from WhatsApp
    const from = req.body.From; // Sender's WhatsApp number

    try {
        messages.push({ "role": "user", "content": incomingMsg });

        // Immediately respond with a waiting message
        await twilioClient.messages.create({
            body: "Finding that out for you now 👀",
            from: "whatsapp:+14155238886", // Twilio WhatsApp number
            to: from
        });

        // Delayed follow-up message after 1 second
        setTimeout(async () => {
            await twilioClient.messages.create({
                body: "Just a moment, almost there...",
                from: "whatsapp:+14155238886", // Your Twilio WhatsApp number
                to: from
            });
        }, 1000); // Delay of 1000 milliseconds (1 second)

        // Insert system prompt here
        messages.push(systemPrompt);

        // Call Chat Completions API
        const response = await openai.chat.completions.create({
            messages: messages,
            model: "gpt-4-1106-preview",
            temperature: 0.5
        });

        let currentResponse = "";
        currentResponse += response.choices[0].message.content;
        messages.push({ "role": "assistant", "content": currentResponse });

        // Reply will be last element of messages array
        const reply = messages[messages.length - 1]?.content;

        if (typeof reply === "string" && reply.trim().length > 0) {
            // Send OpenAI response back to sender via Twilio
            await twilioClient.messages.create({
                body: reply,
                from: "whatsapp:+14155238886", // Twilio WhatsApp number
                to: from
            });
            res.status(200).send("Message processed");
        } else {
            console.error("Error: Invalid response from OpenAI.");
            res.status(200).send(
                "Received empty response from OpenAI, no message sent."
            );
        }
    } catch (error) {
        console.error("Error processing WhatsApp message:", error);
        res.status(500).send("Internal Server Error");
    }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
