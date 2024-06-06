import { 
	Okareo, 
	RunTestProps, 
	components,
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
		const pData: any[] = await okareo.getProjects();
		const project_id = pData.find(p => p.name === PROJECT_NAME)?.id;
		//const path = require( "path" );
		//const webbizz_articles_absolute_path = path.resolve("./.okareo/flows/webbizz_3_articles.jsonl");
        // modified path, the SDK should be handling this
		const webbizz_articles_absolute_path = "./.okareo/flows/webbizz_3_articles.jsonl";
        //TODO: change scenario name as it doesn't need updating reach time
		const scenario: any = await okareo.upload_scenario_set({
			name: "Webbizz Articles Scenario",
			file_path: webbizz_articles_absolute_path,
			project_id: project_id,
		});

		//differences from python: these things didn't exist. do need them? : tags, project_id, models.type, update. and what should they be set as?
	    const model = await okareo.register_model({
			name: MODEL_NAME,
			tags: ["Demo", "Summaries", `Build:${UNIQUE_BUILD_ID}`],
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

	    //differences from python: these things didn't exist. do need them? : tags,
		const eval_run: components["schemas"]["TestRunItem"] = await model.run_test({
			model_api_key: OPENAI_API_KEY,
			name: `${MODEL_NAME} Eval ${UNIQUE_BUILD_ID}`,
			tags: ["Demo", "Summaries", `Build:${UNIQUE_BUILD_ID}`],
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
			// intentionally not blocking the build.
			console.log("The model did not pass the evaluation. Please review the results.");
			//throw new Error("The model did not pass the evaluation. Please review the results.");
		}



	} catch (error) {
		core.setFailed("CI failed because: " + error.message);
	}
}
main();