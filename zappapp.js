import "dotenv/config";
import express from "express";
import OpenAI from "openai";
import twilio from "twilio";

// Initialise Express and Twilio client
const app			= express();
const twilioClient	= twilio(
	process.env.TWILIO_ACCOUNT_SID,
	process.env.TWILIO_AUTH_TOKEN
);

const openai	= new OpenAI({apiKey: process.env.OPENAI_API_KEY});

// Store conversation threads based on WhatsApp numbers
const threads	= new Map();

app.use(express.json());
app.use(express.urlencoded({extended: true}));

// Twilio WhatsApp webhook endpoint
app.post("/whatsapp", async(req, res) =>
{
	const incomingMsg	= req.body.Body; // Message received from WhatsApp
	const from			= req.body.From; // Sender's WhatsApp number

	try
	{
		// Call Chat Completions API
		const completion	= await openai.chat.completions.create(
		{
			messages:	[{"role": "user", "content": incomingMsg}],
			model:		"gpt-4-1106-preview"
		});

		let reply	= completion.choices[0].message.content;

		if (typeof reply === "string" && reply.trim().length > 0)
		{
			// Send OpenAI response back to sender via Twilio
			await twilioClient.messages.create(
			{
				body: reply,
				from: "whatsapp:+14155238886", // Twilio WhatsApp number
				to: from
			});
			res.status(200).send("Message processed");
		}
		else
		{
			console.error("Error: Invalid response from OpenAI.");
			res.status(200).send(
				"Received empty response from OpenAI, no message sent."
			);
		}
	}
	catch (error) 
	{
		console.error("Error processing WhatsApp message:", error);
		res.status(500).send("Internal Server Error");
	}
});