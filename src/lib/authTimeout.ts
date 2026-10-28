export const AUTH_TIMEOUT_MS = 20000;
export const AUTH_CONNECTION_ERROR = 'Serverul de date nu răspunde momentan. Reîncearcă încărcarea.';

export function withAuthTimeout<T>(promise: PromiseLike<T>, ms = AUTH_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(AUTH_CONNECTION_ERROR)), ms);
    Promise.resolve(promise).then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); },
    );
  });
}