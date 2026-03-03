export default function LoadingSpinner({ text = "Loading..." }) {
  return (
    <div className="loader-wrap" role="status" aria-live="polite">
      <span className="spinner" />
      <span>{text}</span>
    </div>
  );
}
