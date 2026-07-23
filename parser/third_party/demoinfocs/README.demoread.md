# DemoRead demoinfocs patch

This directory is the production-package subset of
`github.com/markus-wa/demoinfocs-golang/v5` at the `v5.2.0` tag
(`b1bc851d031fabe44a99680410cac99486d43a41`).

DemoRead carries a narrow local compatibility patch in
`pkg/demoinfocs/datatables.go`: tolerate nil `m_bStartedArming` and
`m_hOwnerEntity` property updates before calling typed `PropertyValue`
accessors. A client demo recorded on 2026-07-23 after the contemporary CS2
update reproducibly panics without those guards. A nil owner is interpreted as
no bomb carrier so drop/clear semantics remain intact.

The real `.dem` extraction regression test owns coverage for the patch. Remove
this snapshot and the `replace` directive in `parser/go.mod` after an upstream
release contains an equivalent guard and the fixture passes against that
release.

Upstream license terms are preserved in `LICENSE.md`.
