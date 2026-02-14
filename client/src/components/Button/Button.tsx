import { FC } from "react";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement>; 
export const Button: FC<ButtonProps> = ({ children, className, ...props }) => {
  return (
    <button
      className={`rounded-lg shadow-sm disabled:bg-gray-700 bg-gray-800 text-gray-100 hover:bg-gray-700 hover:text-white py-2 px-3 active:text-white border border-gray-600 ${className ?? ""}`}
      {...props}
    >
      {children}
    </button>
  );
};
