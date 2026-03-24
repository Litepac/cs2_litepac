package demo

import (
	demoevents "github.com/markus-wa/demoinfocs-golang/v5/pkg/demoinfocs/events"
	msg "github.com/markus-wa/demoinfocs-golang/v5/pkg/demoinfocs/msg"
)

func (s *parseState) registerMetadataHandlers() {
	s.parser.RegisterNetMessageHandler(func(info *msg.CSVCMsg_ServerInfo) {
		s.mapID = info.GetMapName()
	})

	s.parser.RegisterEventHandler(func(warn demoevents.ParserWarn) {
		s.notes = append(s.notes, warn.Message)
	})
}
