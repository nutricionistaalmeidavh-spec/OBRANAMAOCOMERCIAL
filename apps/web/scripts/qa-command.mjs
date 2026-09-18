function quoteWindowsCmdArg(value) {
  const text = String(value);
  if (!/[\s&()^|<>\"]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

export function resolveCommandInvocation(command, args = [], platform = process.platform, env = process.env) {
  if (platform !== 'win32' || !/\.(?:cmd|bat)$/i.test(String(command))) {
    return { command, args: [...args], shell: false };
  }
  const comspec = env.ComSpec || env.COMSPEC || 'cmd.exe';
  const commandLine = [command, ...args].map(quoteWindowsCmdArg).join(' ');
  return { command: comspec, args: ['/d', '/s', '/c', commandLine], shell: false };
}
