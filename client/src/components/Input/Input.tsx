type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  error?: string;
}

export const Input = ({className, error, ...props}:InputProps) => {
  return (
    <div className="pb-8 relative">
      <input
        {...props}
        className={`border-1 border-gray-600 disabled:bg-gray-700 bg-gray-800 p-2 outline-none text-gray-100 hover:bg-gray-700 focus:bg-gray-700 ${className ?? ""}`}
      />
      {error && <p className=" absolute text-red-400">{error}</p>}
    </div>
  );
}