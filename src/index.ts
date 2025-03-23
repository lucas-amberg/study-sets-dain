//File: example/quiz-node.ts

import { z } from "zod";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

import { defineDAINService, ToolConfig } from "@dainprotocol/service-sdk";

import {
    CardUIBuilder,
    TableUIBuilder,
    LayoutUIBuilder,
} from "@dainprotocol/utils";

const port = Number(process.env.PORT) || 2022;

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Initialize Supabase client
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_KEY || "",
);

const generateStudySetConfig: ToolConfig = {
    id: "generate-study-set",
    name: "Generate Study Set",
    description:
        "Generates a study set with multiple choice questions on a specific subject",
    input: z
        .object({
            subject: z.string().describe("Subject to generate study set for"),
            difficulty: z
                .enum(["easy", "medium", "hard"])
                .optional()
                .describe("Study set difficulty level"),
        })
        .describe("Input parameters for the study set generator"),
    output: z
        .object({
            questions: z
                .array(
                    z.object({
                        question: z.string().describe("The study question"),
                        answer: z
                            .string()
                            .describe("The correct answer option"),
                        options: z
                            .array(z.string())
                            .describe("Multiple choice options"),
                        category: z
                            .string()
                            .describe("Category within the subject"),
                        explanation: z
                            .string()
                            .describe("Explanation of the correct answer"),
                    }),
                )
                .describe("Generated study questions"),
        })
        .describe("Generated study set information"),
    pricing: { pricePerUse: 0, currency: "USD" },
    handler: async ({ subject, difficulty = "medium" }, agentInfo, context) => {
        console.log(
            `User / Agent ${agentInfo.id} requested study set on ${subject} with ${difficulty} difficulty`,
        );

        try {
            // Generate questions using OpenAI
            const questions = await generateQuestionsWithOpenAI(
                subject,
                difficulty,
            );

            return {
                text: `Generated a ${difficulty} study set with 5 questions about ${subject}`,
                data: {
                    questions,
                },
                ui: new LayoutUIBuilder()
                    .setRenderMode("page")
                    .setLayoutType("column")
                    .addChild(
                        new CardUIBuilder()
                            .title(`${subject.toUpperCase()} STUDY SET`)
                            .content(
                                `A ${difficulty} difficulty study set with 5 multiple choice questions about ${subject}. Each question has one correct answer.\n\n**Study Set Overview:** This study set covers various aspects of ${subject}. Read each question carefully and select the best answer from the options provided. Answers and explanations can be found at the bottom of the page.`,
                            )
                            .build(),
                    )
                    // Summary table
                    .addChild(
                        new TableUIBuilder()
                            .addColumns([
                                { key: "number", header: "#", type: "number" },
                                {
                                    key: "question",
                                    header: "Question",
                                    type: "string",
                                },
                                {
                                    key: "category",
                                    header: "Category",
                                    type: "string",
                                },
                            ])
                            .rows(
                                questions.map((q, i) => ({
                                    number: i + 1,
                                    question: q.question,
                                    category: q.category,
                                })),
                            )
                            .build(),
                    )
                    // Questions without answers
                    .addChild(createQuestionsLayout(questions, false))
                    // Answers section
                    .addChild(createQuestionsLayout(questions, true))
                    .build(),
            };
        } catch (error) {
            console.error("Error generating study set with OpenAI:", error);

            // Fall back to sample questions if OpenAI fails
            const categories = generateCategories(subject);
            const questions = generateSampleQuestions(
                subject,
                categories,
                difficulty,
            );

            return {
                text: `Generated a ${difficulty} study set with 5 questions about ${subject} (using fallback)`,
                data: {
                    questions,
                },
                ui: new LayoutUIBuilder()
                    .setRenderMode("page")
                    .setLayoutType("column")
                    .addChild(
                        new CardUIBuilder()
                            .title(`${subject.toUpperCase()} STUDY SET`)
                            .content(
                                `A ${difficulty} difficulty study set with 5 multiple choice questions about ${subject}. Each question has one correct answer.\n\n**Study Set Overview:** This study set covers various aspects of ${subject}. Read each question carefully and select the best answer from the options provided. Answers and explanations can be found at the bottom of the page.`,
                            )
                            .build(),
                    )
                    // Summary table
                    .addChild(
                        new TableUIBuilder()
                            .addColumns([
                                { key: "number", header: "#", type: "number" },
                                {
                                    key: "question",
                                    header: "Question",
                                    type: "string",
                                },
                                {
                                    key: "category",
                                    header: "Category",
                                    type: "string",
                                },
                            ])
                            .rows(
                                questions.map((q, i) => ({
                                    number: i + 1,
                                    question: q.question,
                                    category: q.category,
                                })),
                            )
                            .build(),
                    )
                    // Questions without answers
                    .addChild(createQuestionsLayout(questions, false))
                    // Answers section
                    .addChild(createQuestionsLayout(questions, true))
                    .build(),
            };
        }
    },
};

const saveStudySetConfig: ToolConfig = {
    id: "save-study-set",
    name: "Save Study Set",
    description: "Saves a generated study set to the database",
    input: z
        .object({
            subject: z.string().describe("Subject to generate study set for"),
            difficulty: z
                .enum(["easy", "medium", "hard"])
                .optional()
                .describe("Study set difficulty level"),
        })
        .describe("Input parameters for saving study set to database"),
    output: z
        .object({
            studySetId: z.string().describe("ID of the created study set"),
            studySetName: z.string().describe("Name of the created study set"),
            questionCount: z.number().describe("Number of questions saved"),
        })
        .describe("Result of saving the study set to database"),
    pricing: { pricePerUse: 0, currency: "USD" },
    handler: async ({ subject, difficulty = "medium" }, agentInfo, context) => {
        console.log(
            `User / Agent ${agentInfo.id} requested to save a study set on ${subject} with ${difficulty} difficulty`,
        );

        try {
            // Generate questions using OpenAI
            const questions = await generateQuestionsWithOpenAI(
                subject,
                difficulty,
            );

            // Generate a study set name based on the questions
            const studySetName = await generateStudySetName(subject, questions);

            // Save study set to database
            const { studySetId, savedCount } = await saveStudySet(
                studySetName,
                questions,
            );

            return {
                text: `Saved a ${difficulty} study set with ${savedCount} questions about ${subject} as "${studySetName}"`,
                data: {
                    studySetId,
                    studySetName,
                    questionCount: savedCount,
                },
                ui: new LayoutUIBuilder()
                    .setRenderMode("page")
                    .setLayoutType("column")
                    .addChild(
                        new CardUIBuilder()
                            .title(`STUDY SET SAVED: ${studySetName}`)
                            .content(
                                `Successfully saved a ${difficulty} study set with ${savedCount} questions about ${subject}.\n\nStudy Set ID: ${studySetId}\n\n**Study Set Overview:** This study set covers various aspects of ${subject}. Questions and answers have been saved to your study sets.`,
                            )
                            .build(),
                    )
                    // Summary table
                    .addChild(
                        new TableUIBuilder()
                            .addColumns([
                                { key: "number", header: "#", type: "number" },
                                {
                                    key: "question",
                                    header: "Question",
                                    type: "string",
                                },
                                {
                                    key: "category",
                                    header: "Category",
                                    type: "string",
                                },
                            ])
                            .rows(
                                questions.map((q, i) => ({
                                    number: i + 1,
                                    question: q.question,
                                    category: q.category,
                                })),
                            )
                            .build(),
                    )
                    // Questions with answers
                    .addChild(createQuestionsLayout(questions, false))
                    // Answers section
                    .addChild(createQuestionsLayout(questions, true))
                    .build(),
            };
        } catch (error) {
            console.error("Error saving study set to database:", error);
            throw error;
        }
    },
};

/**
 * Generate study questions using OpenAI
 */
async function generateQuestionsWithOpenAI(
    subject: string,
    difficulty: string,
): Promise<any[]> {
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    role: "system",
                    content: `You are a helpful assistant that creates educational study questions based on a specific subject.
                    
                    *** CRITICAL INSTRUCTION: Create EXACTLY 5 multiple-choice questions about "${subject}" with ${difficulty} difficulty. ***
                    
                    Each question should:
                    - Be unique and test different aspects of the subject
                    - Have exactly 4 answer options that are CLEARLY DISTINCT from each other
                    - Have ONLY ONE clearly correct answer - the other 3 should be clearly incorrect
                    - Ensure incorrect options are plausible but definitively wrong
                    
                    Format each question with these fields:
                    - question: The question text
                    - options: Array of 4 possible answers (substantially different from each other)
                    - answer: The EXACT text of the correct option (must match one of the options exactly)
                    - explanation: Brief explanation of why the answer is correct AND why the other options are incorrect
                    - category: A subcategory within "${subject}" that this question belongs to
                    
                    DO NOT create duplicate questions or slight variations of the same question.
                    DO NOT create options that could all be partially correct or similar to each other.
                    
                    Your response must be a JSON object with a 'study_questions' array containing exactly 5 questions.`,
                },
                {
                    role: "user",
                    content: `Create exactly 5 unique multiple-choice questions about ${subject} with ${difficulty} difficulty level.
                    
                    Each question should have 4 answer options that are clearly different from each other, with ONLY ONE correct answer.
                    Make sure the 'answer' field contains the exact text of the correct option.
                    
                    Response should be a JSON object with 'study_questions' array containing 5 questions.`,
                },
            ],
            response_format: { type: "json_object" },
            temperature: 0.7,
            max_tokens: 4000,
        });

        // Extract and parse the response
        const responseText = response.choices[0]?.message?.content || "{}";
        const parsedResponse = JSON.parse(responseText);

        // Get the questions array from the response
        let questions = [];

        if (
            parsedResponse.study_questions &&
            Array.isArray(parsedResponse.study_questions)
        ) {
            questions = parsedResponse.study_questions;
        } else if (Array.isArray(parsedResponse)) {
            questions = parsedResponse;
        } else if (
            parsedResponse.questions &&
            Array.isArray(parsedResponse.questions)
        ) {
            questions = parsedResponse.questions;
        } else if (
            parsedResponse.quiz_questions &&
            Array.isArray(parsedResponse.quiz_questions)
        ) {
            questions = parsedResponse.quiz_questions;
        }

        // Ensure we have exactly 5 questions
        if (questions.length > 5) {
            questions = questions.slice(0, 5);
        } else if (questions.length < 5) {
            // Fill in with sample questions if needed
            const categories = generateCategories(subject);
            const sampleQuestions = generateSampleQuestions(
                subject,
                categories,
                difficulty,
                5 - questions.length,
            );
            questions = [...questions, ...sampleQuestions];
        }

        return questions;
    } catch (error) {
        console.error("Error calling OpenAI API:", error);
        throw error;
    }
}

// Helper function to generate categories based on subject
function generateCategories(subject: string): string[] {
    // Predefined categories for common subjects
    const subjectCategories: Record<string, string[]> = {
        mathematics: [
            "Algebra",
            "Geometry",
            "Calculus",
            "Statistics",
            "Number Theory",
        ],
        history: [
            "Ancient History",
            "Medieval",
            "Modern",
            "World Wars",
            "Political History",
        ],
        science: [
            "Physics",
            "Chemistry",
            "Biology",
            "Astronomy",
            "Earth Science",
        ],
        literature: [
            "Fiction",
            "Poetry",
            "Drama",
            "Literary Theory",
            "World Literature",
        ],
        geography: [
            "Physical Geography",
            "Human Geography",
            "Cartography",
            "Climate",
            "Geology",
        ],
        programming: [
            "Algorithms",
            "Data Structures",
            "Web Development",
            "Databases",
            "Languages",
        ],
    };

    // Normalize subject input
    const normalizedSubject = subject.toLowerCase();

    // Check if we have predefined categories for this subject
    for (const [key, categories] of Object.entries(subjectCategories)) {
        if (normalizedSubject.includes(key)) {
            return categories;
        }
    }

    // Default generic categories if no match
    return ["Fundamentals", "Concepts", "Applications", "Theory", "History"];
}

// Helper function to generate sample questions based on subject and categories
function generateSampleQuestions(
    subject: string,
    categories: string[],
    difficulty: string,
    count = 5,
) {
    const questions = [];

    // Generate questions with different categories
    for (let i = 0; i < count; i++) {
        const category = categories[i % categories.length];
        questions.push(createSampleQuestion(subject, category, difficulty, i));
    }

    return questions;
}

// Helper function to create a sample question
function createSampleQuestion(
    subject: string,
    category: string,
    difficulty: string,
    index: number,
) {
    // In a real implementation, these would be generated by an AI model
    // These are placeholder examples that adapt to the provided subject and category

    const sampleQuestions = [
        {
            subject: "mathematics",
            category: "Algebra",
            question: `What is the solution to the equation 2x + 5 = 15?`,
            options: ["x = 5", "x = 7", "x = 10", "x = 3"],
            answer: "x = 5",
            explanation:
                "Subtracting 5 from both sides: 2x = 10. Then dividing by 2: x = 5.",
        },
        {
            subject: "science",
            category: "Physics",
            question: "What is the unit of electrical resistance?",
            options: ["Watt", "Ohm", "Volt", "Ampere"],
            answer: "Ohm",
            explanation:
                "The ohm (symbol: Ω) is the SI unit of electrical resistance.",
        },
        {
            subject: "history",
            category: "World Wars",
            question: "In which year did World War II end?",
            options: ["1943", "1944", "1945", "1946"],
            answer: "1945",
            explanation:
                "World War II ended in 1945 with the surrender of Germany in May and Japan in September.",
        },
        {
            subject: "geography",
            category: "Physical Geography",
            question: "Which is the longest river in the world?",
            options: ["Amazon", "Nile", "Mississippi", "Yangtze"],
            answer: "Nile",
            explanation:
                "The Nile is the longest river in the world, with a length of approximately 6,650 kilometers.",
        },
        {
            subject: "programming",
            category: "Data Structures",
            question: "Which data structure operates on a LIFO principle?",
            options: ["Queue", "Stack", "Linked List", "Tree"],
            answer: "Stack",
            explanation:
                "A stack follows the Last In, First Out (LIFO) principle where the last element added is the first one to be removed.",
        },
    ];

    // Find questions related to the subject or use default templates
    const relatedQuestions = sampleQuestions.filter(
        (q) =>
            subject.toLowerCase().includes(q.subject) ||
            q.subject.includes(subject.toLowerCase()),
    );

    if (relatedQuestions.length > 0) {
        const template = relatedQuestions[index % relatedQuestions.length];
        return {
            question: template.question,
            options: template.options,
            answer: template.answer,
            category: category,
            explanation: template.explanation,
        };
    }

    // Generate generic questions if no matching subject found
    return {
        question: `What is a key concept in ${subject} related to ${category}?`,
        options: [
            `The theory of ${subject} fundamentals`,
            `The ${category} principle`,
            `The ${subject} methodology in ${category}`,
            `${category} applications in ${subject}`,
        ],
        answer: `The ${category} principle`,
        category: category,
        explanation: `The ${category} principle is a fundamental concept in ${subject} that explains how ${category} phenomena work.`,
    };
}

/**
 * Generate a name for the study set based on the subject and questions
 */
async function generateStudySetName(
    subject: string,
    questions: any[],
): Promise<string> {
    try {
        // Extract categories from questions
        const categories = questions
            .map((q) => q.category)
            .filter((c, index, self) => self.indexOf(c) === index) // Get unique categories
            .slice(0, 3); // Take up to 3 categories

        // Generate a name using OpenAI
        const response = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                {
                    role: "system",
                    content:
                        "You are a helpful assistant that creates concise, engaging and descriptive names for educational study sets.",
                },
                {
                    role: "user",
                    content: `Create a short, captivating name (max 50 characters) for a study set about "${subject}" that covers these categories: ${categories.join(", ")}.`,
                },
            ],
            temperature: 0.7,
            max_tokens: 50,
        });

        let name = response.choices[0]?.message?.content?.trim() || "";

        // Clean up name - remove quotes if present
        name = name.replace(/^["']|["']$/g, "");

        // If no name was generated or it's too long, use a default format
        if (!name || name.length > 50) {
            name = `${subject} Study Set: ${categories.slice(0, 2).join(" & ")}`;

            // Ensure name isn't too long
            if (name.length > 50) {
                name = `${subject} Study Set`;
            }
        }

        return name;
    } catch (error) {
        console.error("Error generating study set name:", error);
        // Fallback name if there's an error
        return `${subject} Study Set (${new Date().toLocaleDateString()})`;
    }
}

/**
 * Save study set and its questions to the database
 */
async function saveStudySet(
    name: string,
    questions: any[],
): Promise<{ studySetId: string; savedCount: number }> {
    if (!Array.isArray(questions) || questions.length === 0) {
        throw new Error("No valid questions to save");
    }

    try {
        // Insert the study set first
        const { data: studySet, error: studySetError } = await supabase
            .from("study_sets")
            .insert({
                name: name,
                made_with_dain: true,
            })
            .select("id")
            .single();

        if (studySetError) {
            console.error("Error creating study set:", studySetError);
            throw new Error(
                `Failed to create study set: ${studySetError.message}`,
            );
        }

        // Convert studySetId to string to match the Zod schema
        const studySetId = String(studySet.id);
        console.log(`Created study set with ID: ${studySetId}`);

        // Save each question
        let savedCount = 0;
        const uniqueQuestions = new Set<string>(); // Track unique questions by text

        for (const question of questions) {
            try {
                // Skip duplicate questions based on question text
                if (uniqueQuestions.has(question.question)) {
                    console.warn(
                        `Skipping duplicate question: "${question.question.substring(0, 30)}..."`,
                    );
                    continue;
                }

                // Add to set of unique questions
                uniqueQuestions.add(question.question);

                // Process category if it exists
                let categoryName = null;
                if (
                    question.category &&
                    typeof question.category === "string"
                ) {
                    try {
                        categoryName = await findOrCreateCategory(
                            question.category,
                            question.question,
                        );
                    } catch (categoryError) {
                        console.error(
                            "Error finding/creating category:",
                            categoryError,
                        );
                        // Continue without category if there's an error
                    }
                }

                // Ensure we have the minimum required fields
                if (!question.question || !question.options) {
                    console.error(
                        "Question missing required fields:",
                        question,
                    );
                    continue;
                }

                // Normalize the options to ensure it's an array
                const options = Array.isArray(question.options)
                    ? question.options
                    : typeof question.options === "string"
                      ? JSON.parse(question.options) // Try to parse JSON string
                      : [];

                if (options.length === 0) {
                    console.error("Question has empty options:", question);
                    continue;
                }

                // Get the correct answer text
                let correctAnswerText = "";
                if (typeof question.answer === "string") {
                    correctAnswerText = question.answer;
                }

                console.log(
                    `Saving question: "${question.question.substring(0, 30)}..." with answer: "${correctAnswerText}"`,
                );

                const { error } = await supabase.from("quiz_questions").insert({
                    study_set: studySetId,
                    question: question.question,
                    options: JSON.stringify(options),
                    answer: correctAnswerText,
                    category: categoryName,
                    explanation: question.explanation || "",
                });

                if (error) {
                    console.error(
                        "Error inserting question to database:",
                        error,
                    );
                } else {
                    savedCount++;
                }
            } catch (questionError) {
                console.error("Error processing question:", questionError);
                // Continue to the next question
            }
        }

        console.log(
            `Saved ${savedCount}/${questions.length} questions successfully`,
        );
        return { studySetId, savedCount };
    } catch (error) {
        console.error("Error saving study set:", error);
        throw error;
    }
}

/**
 * Find or create a category, and associate it with an inferred subject
 */
async function findOrCreateCategory(
    categoryName: string,
    questionText?: string,
): Promise<string | null> {
    try {
        // Check if category exists
        const { data: existingCategory, error: findError } = await supabase
            .from("categories")
            .select("name, subject")
            .eq("name", categoryName)
            .single();

        if (!findError && existingCategory) {
            return existingCategory.name;
        }

        // Use GPT to infer the university major (subject) based primarily on the question text
        const subject = await inferSubjectFromQuestion(
            questionText || "",
            categoryName,
        );

        // Create new subject if it doesn't exist
        if (subject) {
            // Check if subject already exists
            const { data: existingSubject } = await supabase
                .from("subjects")
                .select("subject")
                .eq("subject", subject)
                .single();

            // Create subject if it doesn't exist
            if (!existingSubject) {
                const { error: subjectError } = await supabase
                    .from("subjects")
                    .insert({ subject });

                if (subjectError) {
                    console.error("Error creating subject:", subjectError);
                }
            }
        }

        // Create new category with the inferred subject
        const { data: newCategory, error: createError } = await supabase
            .from("categories")
            .insert({
                name: categoryName,
                subject: subject || null,
            })
            .select("name")
            .single();

        if (createError) {
            console.error("Error creating category:", createError);
            return null;
        }

        return newCategory.name;
    } catch (error) {
        console.error("Error finding or creating category:", error);
        return null;
    }
}

/**
 * Use GPT to infer a university major (subject) based on the question and category
 */
async function inferSubjectFromQuestion(
    questionText: string,
    categoryName: string,
): Promise<string | null> {
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                {
                    role: "system",
                    content: `You are a helpful assistant that categorizes educational topics into university majors.
                    Given a study question and its category, determine which university major it would most likely fall under.
                    Be specific but concise. Return only the name of the major without any explanation or additional text.
                    Examples:
                    - For a question about linear algebra (category: Mathematics), return "Mathematics"
                    - For a question about the American Civil War (category: US History), return "History"
                    - For a question about Shakespeare's plays (category: Literature), return "English Literature"
                    - For a question about Python programming (category: Programming), return "Computer Science"
                    - For a question about quantum mechanics (category: Physics), return "Physics"
                    - For a question about DNA replication (category: Biology), return "Biology"
                    - For a question about marketing strategies (category: Business), return "Marketing"
                    Return a single word or short phrase representing the university major.`,
                },
                {
                    role: "user",
                    content: `What university major would this study question fall under?
                    
                    Question: "${questionText}"
                    Category: ${categoryName}
                    
                    Respond with just the name of the major.`,
                },
            ],
            temperature: 0.3,
            max_tokens: 50,
        });

        let subject = response.choices[0]?.message?.content?.trim();

        // Clean up the response if needed
        if (subject) {
            // Remove any quotation marks, periods, or other formatting
            subject = subject.replace(/['"\.]/g, "");

            // If the response is too verbose, truncate it
            if (subject.includes(" ")) {
                // If there's explanation text, try to extract just the major
                const words = subject.split(" ");
                if (words.length > 4) {
                    // If it's a long response, take just the first few words
                    subject = words.slice(0, 3).join(" ");
                }
            }

            console.log(
                `Inferred subject "${subject}" for question about "${questionText.substring(0, 30)}..." (category: ${categoryName})`,
            );
            return subject;
        }

        return null;
    } catch (error) {
        console.error("Error inferring subject from question:", error);
        return null;
    }
}

/**
 * Helper function to create a layout with individual question cards
 */
function createQuestionsLayout(questions: any[], showAnswers = false) {
    // Create a layout for the questions
    const questionsLayout = new LayoutUIBuilder().setLayoutType("column");

    // Add each question as a card
    questions.forEach((question, index) => {
        // Create a formatted display of options without showing correct answer
        const optionsContent = question.options
            .map((option: string, i: number) => {
                // Format option with letter (A, B, C, D) - no marker for correct answer
                return `${String.fromCharCode(65 + i)}. ${option}`;
            })
            .join("\n\n");

        // Combine question text and options (no explanation yet)
        const content = `**Question:**\n${question.question}\n\n**Options:**\n${optionsContent}`;

        // Create a card for this question
        questionsLayout.addChild(
            new CardUIBuilder()
                .title(`Question ${index + 1}: ${question.category}`)
                .content(content)
                .build(),
        );
    });

    // If we should show answers, add them at the bottom
    if (showAnswers) {
        // Add a card for answers and explanations
        questionsLayout.addChild(
            new CardUIBuilder()
                .title("ANSWERS & EXPLANATIONS")
                .content("Review the correct answers and explanations below:")
                .build(),
        );

        // Add each answer and explanation
        questions.forEach((question, index) => {
            const correctOption = question.options.find(
                (option: string) => option === question.answer,
            );
            const correctOptionIndex = question.options.findIndex(
                (option: string) => option === question.answer,
            );
            const letterAnswer =
                correctOptionIndex >= 0
                    ? String.fromCharCode(65 + correctOptionIndex)
                    : "?";

            const answerContent =
                `**Question ${index + 1}:** ${question.question}\n\n` +
                `**Correct Answer:** ${letterAnswer}. ${correctOption} ✅\n\n` +
                `**Explanation:** ${question.explanation || "No explanation provided."}`;

            questionsLayout.addChild(
                new CardUIBuilder()
                    .title(`Answer ${index + 1}: ${question.category}`)
                    .content(answerContent)
                    .build(),
            );
        });
    }

    return questionsLayout.build();
}

const dainService = defineDAINService({
    metadata: {
        title: "StudySets DAIN Service",
        description:
            "A DAIN service for generating educational study sets on any subject",
        version: "1.0.0",
        author: "Your Name",
        tags: ["study sets", "education", "learning", "assessment", "dain"],
        logo: "https://cdn-icons-png.flaticon.com/512/4697/4697984.png",
    },
    exampleQueries: [
        {
            category: "Study Sets",
            queries: [
                "Generate a study set about mathematics",
                "Create a study set on history",
                "I want to practice science questions",
                "Give me a study set on literature",
                "Create programming questions for me",
                "Save a biology study set",
                "Create and save a physics study set",
            ],
        },
    ],
    identity: {
        apiKey: process.env.DAIN_API_KEY,
    },
    tools: [generateStudySetConfig, saveStudySetConfig],
});

dainService.startNode({ port: port }).then(({ address }) => {
    console.log("StudySets DAIN Service is running at :" + address().port);
});
