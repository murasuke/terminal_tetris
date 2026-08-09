type VBButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {};

export function VBButton({
  className = '',
  children,
  ...props
}: VBButtonProps) {
  return (
    <button className={`vb-button ${className}`} {...props}>
      {children}
    </button>
  );
}

<VBWindow title="社員マスタメンテ" status={status}>
  <VBForm onSubmit={handleSubmit}>
    <VBFrame title="【社員情報】">
      <VBTextBox label="メールアドレス：" />
      <VBTextBox label="姓：" />
      <VBTextBox label="名：" />
    </VBFrame>
    <VBButton type="submit">登録</VBButton>
    <VBButton type="button">クリア</VBButton>
  </VBForm>
</VBWindow>;
