/**
 * Sample exercising the tree-sitter grammar (grammar/grammar.js).
 * Expected captures are noted on the right (see queries/ql/highlights.scm).
 */
import javascript
import semmle.code.cpp.padding.Padding as Pad
import semmle.code.java.Arrays

/** A doc comment with @tags. */
cached
private bindingset[x] predicate pointless(int x) {
  x = 1 and not exists(int y | y = 2)
}

module M implements MySig {
  class MyNode extends Node, Element {
    private string name;

    MyNode() { name = "node" }             // characteristic predicate

    MyNode getANode() { result = this }

    MyNode getStrictlyPositive() {
      this.getANode().getStrictlyPositive*()
      or forall(MyNode n | n = this | n instanceof MyNode)
    }

    string format(int i, float f, boolean b, date d) {
      result = "a \"string\" with escapes\n"
    }
  }

  newtype TSize =
    TSmall()
    or
    TLarge()

  pragma[inline]
  private int silly() { result = 1 }

  language[monotonicAggregates]
  private string tagged() { result = "x" }

  predicate default(String s) { s = "y" }
}

from MyNode n, Node m
where n.getName() = m.getName()
  and n in m
  and 1 + 2 * 3 / 4 - 5 % 6 <= 7
  and 3.14 != count(m)
  and count(m.getAChild+()) > rank[n](m)
  and any(Foo f | f = m) = m
  and m instanceof @disposable
  and if n = m then true() else false()
  and not forall(Foo f | f = m | f = f)
select n as node, m order by m asc, n desc
