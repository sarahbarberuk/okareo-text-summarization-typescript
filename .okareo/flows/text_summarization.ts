import { 
	Okareo, 
	RunTestProps, 
	components,
	SeedData,
    TestRunType, 
    OpenAIModel,
    GenerationReporter,
} from "okareo-ts-sdk";

import * as core from "@actions/core";

const OKAREO_API_KEY = process.env.OKAREO_API_KEY;

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const UNIQUE_BUILD_ID = (process.env.DEMO_BUILD_ID || `local.${(Math.random() + 1).toString(36).substring(7)}`);

const PROJECT_NAME = "Global";
const MODEL_NAME = "Text Summarizer";

const USER_PROMPT_TEMPLATE = "{input}"
const SUMMARIZATION_CONTEXT_TEMPLATE = "You will be provided with text. Summarize the text in 1 simple sentence."

const main = async () => {
	try {
		const okareo = new Okareo({api_key: OKAREO_API_KEY });
		const project: any[] = await okareo.getProjects();
		const project_id = project.find(p => p.name === PROJECT_NAME)?.id;

        // create scenario set
        const TEST_SEED_DATA = [
		    SeedData({
		        input:"Mathematics is an area of knowledge that includes the topics of numbers, formulas and related structures, shapes and the spaces in which they are contained, and quantities and their changes. These topics are represented in modern mathematics with the major subdisciplines of number theory,[1] algebra,[2] geometry,[1] and analysis,[3] respectively. There is no general consensus among mathematicians about a common definition for their academic discipline.",  
		        result:"75eaa363-dfcc-499f-b2af-1407b43cb133"
		    }),
		    SeedData({
		        input:"Some areas of mathematics, such as statistics and game theory, are developed in close correlation with their applications and are often grouped under applied mathematics. Other areas are developed independently from any application (and are therefore called pure mathematics), but often later find practical applications.[5][6]",  
		        result:"ac0d464c-f673-44b8-8195-60c965e47525"
		    }),
		    SeedData({
		        input:"WebBizz places immense value on its dedicated clientele, recognizing their loyalty through the exclusive 'Premium Club' membership. This special program is designed to enrich the shopping experience, providing a suite of benefits tailored to our valued members. Among the advantages, members enjoy complimentary shipping, granting them a seamless and cost-effective way to receive their purchases. Additionally, the 'Premium Club' offers early access to sales, allowing members to avail themselves of promotional offers before they are opened to the general public.", 
		        result:"aacf7a34-9d3a-4e2a-9a5c-91f2a0e8a12d"
		    })
		];

        const scenario: any = await okareo.create_scenario_set(
            {
            name: "Webbizz Articles for Text Summarization Scenario Set",
            project_id: project_id,
            seed_data: TEST_SEED_DATA
            }
        );

        //or, upload scenario set from file
        // const webbizz_articles_absolute_path = "./.okareo/flows/webbizz_3_articles.jsonl";
		// const scenario: any = await okareo.upload_scenario_set({
		// 	name: "Webbizz Articles Scenario",
		// 	file_path: webbizz_articles_absolute_path,
		// 	project_id: project_id,
		// });

	    const model = await okareo.register_model({
			name: MODEL_NAME,
			tags: [`Build:${UNIQUE_BUILD_ID}`],
			project_id: project_id,
			models: {
				type: "openai",
				model_id:"gpt-3.5-turbo",
				temperature:0.5,
				system_prompt_template:SUMMARIZATION_CONTEXT_TEMPLATE,
				user_prompt_template:USER_PROMPT_TEMPLATE,
			} as OpenAIModel,
			update: true,
		});

        // run LLM evlauation
		const eval_run: components["schemas"]["TestRunItem"] = await model.run_test({
			model_api_key: OPENAI_API_KEY,
			name: `${MODEL_NAME} Eval ${UNIQUE_BUILD_ID}`,
			tags: [`Build:${UNIQUE_BUILD_ID}`],
			project_id: project_id,
			scenario: scenario,
			calculate_metrics: true,
			type: TestRunType.NL_GENERATION,
			checks: [
				"coherence_summary",
				"consistency_summary",
				"fluency_summary",
				"relevance_summary"
			]
		} as RunTestProps);


		// reporting
		const report_definition = {
			metrics_min: {
				"coherence": 4.0,
				"consistency": 4.0,
				"fluency": 4.0,
				"relevance": 4.0,
			}
		};

		const reporter = new GenerationReporter({
				eval_run :eval_run, 
				...report_definition,
		});
		reporter.log();
		
		if (!reporter.pass) {
			core.setFailed("CI failed because the Okareo reporter failed.");
		}
	} catch (error) {
		core.setFailed("CI failed because: " + error.message);
	}
}
main();