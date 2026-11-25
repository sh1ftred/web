Feature: The shell shares a controller with the focused applet
  The two stick clicks together call the shell. Other buttons belong to the
  focused applet until the person returns to the shell and lets go.

  Scenario: A shell press moves or acts once, even when held
    Given a page reading a standard shell controller
    When its controller samples are "neutral, up, up, neutral, down, neutral, left, neutral, right, neutral, A, A, neutral, B, neutral, LB, neutral, RB, neutral, Y"
    Then the controller sent "previous, next, previous, next, activate, back, previous-window, next-window, stacks"

  Scenario: A tilted left stick is a direction, not a stream of button presses
    Given a page reading a standard shell controller
    When its controller samples are "neutral, tilt-up, slight-up, tilt-up, neutral, tilt-left, neutral, tilt-down, neutral, tilt-right+A"
    Then the controller sent "previous, previous, next, next"

  Scenario: Toyrocket keeps ordinary buttons and each stick click on its own
    Given a page reading a standard shell controller
    When its applet owns the controller
    And its controller samples are "neutral, up, neutral, A, neutral, Y, neutral, menu, neutral, LB, neutral, RB, neutral, R3, neutral, L3, L3+R3, L3, L3+R3, neutral, R3+L3"
    Then the controller sent "home, home"

  Scenario: A held press is not replayed on connection or on returning from an applet
    Given a page reading a standard shell controller
    When its controller samples are "A, A, neutral"
    And its applet owns the controller
    And its controller samples are "neutral, A"
    And its shell owns the controller
    And its controller samples are "A, A+B, neutral, B"
    Then the controller sent "back"

  Scenario: A hidden page and an unfocused page do not read the controller
    Given a page reading a standard shell controller
    When its controller samples are "neutral"
    And the controller page is hidden
    And its controller samples are "A"
    And the controller page is visible
    And its controller samples are "A, neutral"
    And the controller page is blurred
    And its controller samples are "L3+R3"
    And the controller page is focused
    And its controller samples are "L3+R3, neutral, Y"
    Then the controller sent "stacks"

  Scenario: Confirm hands input to the applet only after release
    Given a page reading a standard shell controller
    When its controller samples are "neutral, A, A"
    Then the controller sent nothing
    When its controller samples are "neutral"
    Then the controller sent "activate"
    When its controller samples are "A+right, A, neutral, A, A+LB, neutral"
    Then the controller sent "activate, next, previous-window"

  Scenario: Connection changes and restricted browser APIs fail closed
    Given a page reading a standard shell controller
    When its controller samples are "neutral"
    And its controller reader becomes "disconnected"
    And its controller reader becomes "unmapped"
    And its controller reader becomes "denied"
    And its controller reader becomes "standard"
    And its controller samples are "A, neutral, B"
    Then the controller sent "back"
    When the shell controller reader stops
    And its controller reader becomes "standard"
    Then the controller is not polling

  Scenario: A prompt replacing another prompt cannot inherit its confirm
    Given a page reading a standard shell controller
    When its controller samples are "neutral, A"
    And a new controller prompt arrives
    And its controller samples are "neutral, neutral"
    Then the controller sent nothing
    When its controller samples are "A, neutral"
    Then the controller sent "activate"

  Scenario: A browser without controller support can still start and stop the shell
    Then installing the shell controller without a native reader is harmless

  Scenario: A queued sample sees a background tab even before its blur event
    Given a page reading a standard shell controller
    When its controller samples are "neutral, A"
    And the controller page loses focus before the browser sends blur
    And its controller samples are "neutral"
    Then the controller sent nothing
    And the controller is not polling

  Scenario: Releasing confirm with another gameplay control held does not hand it to an applet
    Given a page reading a standard shell controller
    When its controller samples are "neutral, A, X, neutral, A, slight-up, neutral"
    Then the controller sent nothing
