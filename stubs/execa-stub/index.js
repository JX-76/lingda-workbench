export async function execa() {
  return {
    stdout: '',
    stderr: '',
    exitCode: 0,
    failed: false,
    timedOut: false,
    isCanceled: false,
    killed: false,
    command: '',
    escapedCommand: '',
  }
}

export function execaSync() {
  return {
    stdout: '',
    stderr: '',
    exitCode: 0,
    failed: false,
    timedOut: false,
    isCanceled: false,
    killed: false,
    command: '',
    escapedCommand: '',
  }
}

export const execaCommand = execa
export const execaCommandSync = execaSync
export default execa
