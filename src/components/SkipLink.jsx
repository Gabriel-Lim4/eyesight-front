function SkipLink() {
  return (
    <a
      href="#main-content"
      style={{
        position: "absolute",
        top: "-40px",
        left: "0",
        background: "#3b82f6",
        color: "white",
        padding: "8px 16px",
        zIndex: 1000,
        transition: "top 0.2s",
        borderRadius: "0 0 8px 0",
        textDecoration: "none",
        fontWeight: 600,
      }}
      onFocus={(e) => (e.currentTarget.style.top = "0")}
      onBlur={(e) => (e.currentTarget.style.top = "-40px")}
    >
      Pular para o conteúdo principal
    </a>
  );
}

export default SkipLink;
