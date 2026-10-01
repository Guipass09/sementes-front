import PhoneInput, { getCountries, getCountryCallingCode, isPossiblePhoneNumber, parsePhoneNumber } from "react-phone-number-input";
import pt from "react-phone-number-input/locale/pt";
import "react-phone-number-input/style.css";
import "./international-phone-field.css";

type InternationalPhoneFieldProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  invalid?: boolean;
  className?: string;
};

const countryLabels = Object.fromEntries(
  getCountries().map((country) => [country, `${(pt as Record<string, string>)[country] ?? country} (+${getCountryCallingCode(country)})`])
);

export const validateRegistrationPhone = (value: string): { valid: boolean; message: string } => {
  if (!value) return { valid: false, message: "Celular é obrigatório" };

  const phone = parsePhoneNumber(value);
  if (!phone || !isPossiblePhoneNumber(value)) {
    return { valid: false, message: "Informe um celular válido com DDD e código do país" };
  }

  if (phone.country === "BR" && !/^\d{2}9\d{8}$/.test(phone.nationalNumber)) {
    return { valid: false, message: "Informe um celular brasileiro com DDD e 9 dígitos" };
  }

  return { valid: true, message: "" };
};

export default function InternationalPhoneField({
  id,
  value,
  onChange,
  onBlur,
  invalid = false,
  className = "",
}: InternationalPhoneFieldProps) {
  return (
    <PhoneInput
      id={id}
      name="phone"
      type="tel"
      value={value}
      onChange={(nextValue) => onChange(nextValue ?? "")}
      onBlur={onBlur}
      defaultCountry="BR"
      addInternationalOption={false}
      international
      countryCallingCodeEditable={false}
      labels={{ ...pt, ...countryLabels }}
      autoComplete="tel"
      inputMode="tel"
      placeholder="(11) 99999-9999"
      aria-label="Celular com código do país e DDD"
      aria-invalid={invalid}
      className={`international-phone-field ${invalid ? "international-phone-field--invalid" : ""} ${className}`.trim()}
    />
  );
}
