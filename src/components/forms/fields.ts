export type Field = {
  name: string;
  label: string;
  type?:
    | "text"
    | "email"
    | "number"
    | "date"
    | "datetime-local"
    | "textarea"
    | "select"
    | "password";
  required?: boolean;
  min?: number;
  step?: number | string;
  max?: number;
  maxLength?: number;
  nullable?: boolean;
  disabled?: boolean;
  options?: { value: string; label: string }[];
};
