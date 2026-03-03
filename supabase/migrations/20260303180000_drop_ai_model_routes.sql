-- Remove legacy capability route table; active model order now comes from ai_models.
DROP TABLE IF EXISTS public.ai_model_routes;
