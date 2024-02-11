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

		// Call Chat Completions API
		const response = await openai.chat.completions.create(
			{
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
			await twilioClient.messages.create(
				{
					body: reply,
					from: "whatsapp:+14155238886", // Twilio WhatsApp number
					to: from
				});
			res.status(200).send("Message processed");
		}
		else {
			console.error("Error: Invalid response from OpenAI.");
			res.status(200).send(
				"Received empty response from OpenAI, no message sent."
			);
		}
	}
	catch (error) {
		console.error("Error processing WhatsApp message:", error);
		res.status(500).send("Internal Server Error");
	}
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));