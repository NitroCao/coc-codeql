// error-tolerance check: unterminated string + stray tokens
import javascript

predicate oops(string s) {
  s = "unterminated
  and 1 + )
}
