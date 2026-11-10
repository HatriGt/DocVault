// The prebuilt browser bundle has no own typings; it exposes the same API as 'mammoth'.
declare module 'mammoth/mammoth.browser' {
  import mammoth from 'mammoth';
  export default mammoth;
}
