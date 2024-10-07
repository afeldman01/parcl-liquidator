import Joi from "joi";

export const schema = Joi.object({
  NODE_ENV: Joi.string().required(),
  PORT: Joi.number().required(),
});
