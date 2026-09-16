(() => {
  const approvalCard = document.getElementById('teacherApprovalCard');
  if (!approvalCard) return;

  function protectAdminRows() {
    approvalCard.querySelectorAll('[data-approved-teacher-list] .teacher-lesson-item').forEach((row) => {
      const roleText = row.querySelector('small')?.textContent || '';
      const isSchoolAdmin = roleText.includes('학교 관리자');
      const isMe = roleText.includes('내 계정');
      if (!isSchoolAdmin || isMe) return;

      const button = row.querySelector('[data-revoke-teacher]');
      if (!button) return;

      const label = document.createElement('span');
      label.className = 'read-only-label';
      label.textContent = '관리자 계정 · 운영자만 변경';
      button.replaceWith(label);
    });
  }

  const observer = new MutationObserver(protectAdminRows);
  observer.observe(approvalCard, { childList: true, subtree: true });
  protectAdminRows();
})();
