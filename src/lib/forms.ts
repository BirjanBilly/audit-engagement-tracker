export type FormState = {
  ok: boolean;
  message: string;
  fieldErrors?: Record<string, string[]>;
};

export const initialFormState: FormState = {
  ok: false,
  message: "",
};
