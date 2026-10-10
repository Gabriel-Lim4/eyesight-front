import { FiMoon, FiSun } from "react-icons/fi";
import { useTheme } from "../hooks/useTheme";

function ThemeToggle({ className = "" }) {
  const { lightMode, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      className={`theme-toggle ${className}`.trim()}
      onClick={toggleTheme}
      aria-label={lightMode ? "Ativar modo escuro" : "Ativar modo claro"}
      title={lightMode ? "Modo escuro" : "Modo claro"}
    >
      {lightMode ? <FiMoon /> : <FiSun />}
    </button>
  );
}

export default ThemeToggle;
